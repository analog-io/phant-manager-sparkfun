/**
 * phant-manager-http
 * https://github.com/sparkfun/phant-manager-http
 *
 * Copyright (c) 2014 SparkFun Electronics
 * Licensed under the GPL v3 license.
 */

/**** Module dependencies ****/
var express = require('express'),
  path = require('path'),
  util = require('util'),
  url = require('url'),
  events = require('events'),
  favicon = require('static-favicon'),
  bodyParser = require('body-parser'),
  exphbs = require('express3-handlebars');

/**** helpers ****/
var handlebars = require('./helpers/handlebars');

/**** routes ****/
var index = require('./routes'),
  stream = require('./routes/stream');

var app = {};

/**** Expose PhantManager ****/
exports = module.exports = PhantManager;

/**** Initialize a new PhantManager ****/
function PhantManager(config) {

  config = config || {};

  // create a responder
  var responder = function(req, res) {

    if (res.headersSent) {
      return function(req, res) {
        return;
      };
    }

    if (req.url.match(/^\/input\//)) {
      return function(req, res) {
        return;
      };
    }

    if (req.url.match(/^\/output\//)) {
      return function(req, res) {
        return;
      };
    }

    return responder.express.call(this, req, res);

  };

  util._extend(responder, events.EventEmitter.prototype);
  util._extend(responder, app);
  util._extend(responder, config);

  responder.express = responder.expressInit();

  return responder;

}

app.metadata = false;
app.keychain = false;
app.validator = false;
app.notifiers = [];

app.expressInit = function() {

  var exp = express();

  exp.engine('handlebars', exphbs({
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    defaultLayout: 'main',
    helpers: handlebars
  }));

  exp.set('view engine', 'handlebars');
  exp.set('views', path.join(__dirname, 'views'));

  exp.use(
    favicon(
      path.join(__dirname, 'public', 'img', 'favicon.ico'), {
        maxAge: 2592000000
      } // 1 month
    )
  );

  exp.use(express.compress());
  exp.use(bodyParser.json());
  exp.use(bodyParser.urlencoded());
  exp.use(this.responseType);

  exp.use(function(req, res, next) {

    res.header('X-Powered-By', 'phant');

    res.locals.url = url.parse(req.url);
    res.locals.url.protocol = req.protocol;
    res.locals.url.host = req.get('host');

    if (req.headers['phant-private-key']) {
      req.query.privateKey = req.headers['phant-private-key'];
    }

    if (req.headers['phant-delete-key']) {
      req.query.deleteKey = req.headers['phant-delete-key'];
    }

    next();

  });

  if (exp.get('env') === 'development') {

    exp.use(express.static(
      path.join(__dirname, 'public')
    ));

  } else {

    exp.enable('view cache');

    exp.use(express.static(
      path.join(__dirname, 'public'), {
        maxAge: 604800000
      }
    ));

  }

  exp.use(exp.router);

  /**** 404 handler ****/
  exp.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  /**** error handler ****/
  exp.use(function(err, req, res, next) {

    var status = err.status || 200;

    res.format({
      html: function() {
        res.status(status).render('error', {
          message: err.message,
          error: {}
        });
      },
      json: function() {
        res.json(status, {
          success: (status === 200 ? true : false),
          message: err.message
        });
      }
    });

  });

  exp.post('/config', index.createPackage);
  exp.post('/streams.:ext', stream.create.bind(this));
  exp.post('/streams', stream.create.bind(this));
  exp.post('/streams/:publicKey/notify/:type.:ext', stream.notify.bind(this));
  exp.post('/streams/:publicKey/notify/:type', stream.notify.bind(this));

  exp.delete('/streams/:publicKey.:ext', stream.remove.bind(this));
  exp.delete('/streams/:publicKey', stream.remove.bind(this));

  exp.get('/', index.home);
  exp.get('/config', index.config);
  exp.get('/streams/make', stream.make);
  exp.get('/streams/delete', stream.delete);
  exp.get('/streams/clear', stream.clear);
  exp.get('/streams/tag/:tag.:ext', stream.tag.bind(this));
  exp.get('/streams/tag/:tag', stream.tag.bind(this));
  exp.get('/streams/:publicKey/delete/:deleteKey.:ext', stream.remove.bind(this));
  exp.get('/streams/:publicKey/delete/:deleteKey', stream.remove.bind(this));
  exp.get('/streams/:publicKey.:ext', stream.view.bind(this));
  exp.get('/streams/:publicKey', stream.view.bind(this));
  exp.get('/streams.:ext', stream.list.bind(this));
  exp.get('/streams', stream.list.bind(this));

  return exp;

};


app.responseType = function(req, res, next) {

  if (url.parse(req.url).pathname.match(/\.json$/)) {
    req.headers.accept = 'application/json';
  } else if (url.parse(req.url).pathname.match(/\.txt$/)) {
    req.headers.accept = 'text/plain';
  }

  next();

};

app.touch = function(id) {

  if (!this.metadata) {
    return;
  }

  this.metadata.touch(id, function(err) {

    if (err) {
      this.emit('error', err);
    }

  }.bind(this));

};

app.notify = function(type, options, stream) {

  var self = this;

  this.notifiers.forEach(function(notify) {

    var func = notify[type];

    func.call(notify, options, stream, function(err) {

      if (err) {
        self.emit('error', 'notify error - ' + err);
      }

    });

  });

};

app.getNotifiers = function(type) {

  var list = [];

  this.notifiers.forEach(function(notify) {

    list.push({
      name: notify.name,
      type: type,
      expect: notify.expect(type)
    });

  });

  return list;

};

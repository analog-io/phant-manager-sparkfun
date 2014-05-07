exports.make = function(req, res) {
  res.render('streams/make', { title: 'new stream' });
};

exports.list = function(req, res, next) {

  var self = this;

  this.metadata.listByActivity(function(err, streams) {

    if(err) {
      err = new Error('loading the stream list failed.');
      err.status = 500;
      next(err);
      return;
    }

    streams = streams.map(function(stream) {
      stream.publicKey = self.keychain.publicKey(stream.id);
      return stream;
    });

    res.render('streams/list', {
      title: 'public streams',
      streams: streams
    });

  });

};

exports.tag = function(req, res, next) {

  var self = this,
      tag = req.param('tag');

  this.metadata.listByTag(tag, function(err, streams) {

    if(err) {
      err = new Error('loading the stream list failed.');
      err.status = 500;
      next(err);
      return;
    }

    streams = streams.map(function(stream) {
      stream.publicKey = self.keychain.publicKey(stream.id);
      return stream;
    });

    res.render('streams/list', {
      title: 'streams tagged: ' + tag,
      streams: streams
    });

  });

};

exports.view = function(req, res, next) {

  var id = this.keychain.getIdFromPublicKey(req.param('publicKey'));

  this.metadata.get(id, function(err, stream) {

    if(! stream || err) {
      err = new Error('stream not found');
      err.status = 404;
      next(err);
      return;
    }

    res.render('streams/view', {
      title: 'stream ' + req.param('publicKey'),
      publicKey: req.param('publicKey'),
      stream: stream
    });

  });

};

exports.create = function(req, res, next) {

  var fields = [],
      tags = [],
      self = this,
      err;

  if(req.param('check') !== '') {
    err = new Error('Bot check failed');
    err.status = 400;
    next(err);
    return;
  }

  if(req.param('tags').trim()) {
    tags = req.param('tags').split(',').map(function(tag) {
      return tag.trim();
    });
  }

  if(req.param('fields').trim()) {
    fields = req.param('fields').split(',').map(function(field) {
      return field.trim();
    });
  }


  this.metadata.create({
    title: req.param('title'),
    description: req.param('description'),
    fields: fields,
    tags: tags,
    hidden: (req.param('hidden') === '1' ? true : false)
  }, function(err, stream) {

    if(err) {
      err = new Error('creating stream failed');
      next(err);
      return;
    }

    res.render('streams/create', {
      title: 'stream ' + self.keychain.publicKey(stream.id),
      stream: stream,
      publicKey: self.keychain.publicKey(stream.id),
      privateKey: self.keychain.privateKey(stream.id),
      deleteKey: self.keychain.deleteKey(stream.id)
    });

  });

};


exports.remove = function(req, res, next) {

  var pub = req.param('publicKey'),
      del = req.param('deleteKey'),
      self = this,
      id, err;

  // check for public key
  if(! pub) {
    err = new Error('Not Found');
    err.status = 404;
    next(err);
    return;
  }

  // check for private key
  if(! del) {
    err = new Error('forbidden: missing private key');
    err.status = 403;
    next(err);
    return;
  }

  // validate keys
  if(! this.keychain.validateDeleteKey(pub, del)) {
    err = new Error('forbidden: invalid delete key');
    err.status = 401;
    next(err);
    return;
  }

  id = this.keychain.getIdFromPublicKey(pub);

  this.metadata.remove(id, function(err, success) {

    if(err) {
      err = new Error('deleting the stream failed');
      err.status = 500;
      next(err);
      return;
    }

    self.emit('clear', id);

    req.url = '/streams';
    res.locals.messages = {
      'success': ['Deleted stream: ' + pub]
    };
    next();

  });

};


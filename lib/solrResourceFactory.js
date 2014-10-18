'use strict';
var _ = require('jstk').bind(require('lodash'));
var createSolrClient = require('solr-client').createClient;
var MLT_DEFAULTS = { mindf: 1, mintf: 1 };

module.exports = function(options) {
  var config = options.config || require('./config');
  var logger = options.logger || require('./consoleLogger');
  var loggerEventName =
      options.loggerEventName || 'amqp2solr-solrResource';
  var credentials = config.get('private:SOLR_CREDENTIALS');
  options = _.defaults(options || {}, {
    core: '',
    fields: {},
    transformations: {}
  });
  var solr = createSolrClient(
      _(options).
          pick('core').
          assign(config.get('private:SOLR_CONFIG')).
          value());
  solr.basicAuth(credentials.username, credentials.password);

  function transform(transformation, key, value) {
    transformation = options.transformations ? options.transformations[key] &&
        options.transformations[key][transformation] || null : null;
    return (transformation) ? transformation(value) : value;
  }
  function encode(doc) {
    return _.reduce(doc, function (acc, v, sourceKey) {
      var targetKey = options.fields[sourceKey] || sourceKey;
      if (doc[sourceKey]) {
        acc[targetKey] = transform('toSolr', sourceKey, doc[sourceKey]);
      }
      return acc;
    }, {});
  }
  function decode(doc) {
    return _.reduce(doc, function(acc, v, sourceKey) {
      var targetKey = _.findKey(options.fields,
                                  _.partial(_.isEqual, sourceKey)) || sourceKey;
      if (doc[sourceKey]) {
        acc[targetKey] = transform('fromSolr', targetKey, doc[sourceKey]);
      }
      return acc;
    }, {});
  }

  function add(docs, cb) {
    if (!docs) {
      var err = new Error('solrResource.noDocument');
      if (cb) { cb(err); }
      return err;
    }
    var docs = _.isArray(docs) ?_.map(docs, encode) : encode(docs);
    var req = solr.add(docs, function(err, res) {
      logger[err ? 'error' : 'info'](loggerEventName, {
        action: 'add',
        core: options.core,
        err: err,
        stack: err ? err.stack : null,
        responseHandler: res ? res.responseHandler : null,
        path: req.path
      });
      if (cb) {
        cb(err, res);
      }
    });
  }

  function updateRaw(query, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = _.defaults(opts || {}, { logging: true });

    var req = solr.update(
        _.isArray(query) ? query : [query],
        function(err, res) {
          if (opts.logging !== false) {
            logger[err ? 'error' : 'info'](loggerEventName, {
              action: 'update',
              core: options.core,
              err: err,
              stack: err ? err.stack : null,
              responseHandler: res ? res.responseHandler : null,
              path: req.path
            });
          }
          if (cb) {
            cb(err, res);
          }
        });
  }

  function find(q, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    q = encode(_.isString(q) ? {id : q} : q);
    opts = _.defaults(opts, { logging: true });
    var req = solr.search(solr.createQuery().q(q), function(err, res) {
      if (opts.logging) {
        logger[err ? 'error' : 'info'](loggerEventName, {
          action: 'find',
          q: q,
          core: options.core,
          err: err,
          stack: err ? err.stack : null,
          responseHandler: res ? res.responseHandler : null,
          path: req.path
        });
      }
      cb(err, res && res.response && res.response.docs ?
          _.map(res.response.docs, decode) : null);
    });
  }

  function findAndModify(q, updateParams, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = _.defaults(opts || {}, { upsert: false });
    find(q, { logging: false }, function(err, docs) {
      if (err) {
        logger.error(loggerEventName, {
          action: 'findAndModify',
          q: q,
          updateParams: updateParams,
          core: options.core,
          err: err,
          stack: err ? err.stack : null
        });
        return cb ? cb(err) : err;
      }
      if (opts.upsert && !(docs && docs.length)) {
        docs = [encode(_.isString(q) ? {id : q} : q)];
      }
      if (docs && docs.length) {
        var docs = _.map(docs, function(doc) {
          return _.assign(_.omit(doc, '_version_'), updateParams);
        });
        updateRaw(docs, { logging: false }, function(err, addResult) {
          logger[err ? 'error' : 'info'](loggerEventName, {
            action: 'findAndModify',
            addResult: addResult,
            q: q,
            updateParams: updateParams,
            core: options.core,
            err: err,
            stack: err ? err.stack : null
          });
          if (cb) {
            cb(err, addResult);
          }
        });
      }
    });
  }
  function createOrUpdate(q, p, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    findAndModify(q, p, _.assign(opts || {}, { upsert: true }), cb);
  }

  function moreLikeThis(q, mlt, cb) {
    if (typeof mlt === 'function') { cb = mlt; mlt = options.mlt || {}; }
    q = encode(_.isString(q) ? {id : q} : q);
    var req = solr.search(solr.createQuery().q(q).
        mlt(_.defaults(mlt || options.mlt, MLT_DEFAULTS)), function(err, res) {
      logger[err ? 'error' : 'info'](loggerEventName, {
        action: 'moreLikeThis',
        core: options.core,
        err: err,
        stack: err ? err.stack : null,
        responseHandler: res ? res.responseHandler : null,
        path: req.path
      });
      if (cb) {
        cb(err, err ? null :
            _(res.moreLikeThis).pluck('docs').flatten().map(decode).value());

      }
    });
  }

  function findAndAtomic(atomicUpdateType, doc, updateParams, cb) {
    updateRaw(_(updateParams).
        unpluck(atomicUpdateType).
        assign(typeof doc === 'object' ? encode(doc) : {id: doc}).
        value(), cb);
  }

  var atomicUpdateActions = {
    update: 'set',  // update an existing field
    appendValues: 'add',
    removeValues: 'delete'
  };
  var solrActions = {
    delete: 'deleteByQuery',
    deleteById: 'deleteByID',
    commit: 'commit'
  };
  return _({
    // all setters, inc. solrActions has to be listed in module.exports.setters:
    add: add, // add(doc, cb) a new field

    findAndModify: findAndModify, // findAndModify(q, updateParams, cb) a doc
    createOrUpdate: createOrUpdate, // createOrUpdate(q, updateParams, cb) a doc

    find: find, // find(q, cb),
    moreLikeThis: moreLikeThis, // moreLikeThis(q, [mlt,] cb)
    recommend: moreLikeThis,
    encode: encode, // formats object to solr
    decode: decode, // decodes solr format (field name and value transformation mapping
    solr: solr,
    solrResourceOptions: options
  } ).bindResource(solr, solrActions).
      bindPartials(findAndAtomic, atomicUpdateActions).
      value();
};
module.exports.setters = ['add', 'findAndModify', 'createOrUpdate', 'commit'];
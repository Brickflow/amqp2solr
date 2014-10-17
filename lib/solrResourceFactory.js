'use strict';
var _ = require('jstk').bind(require('lodash'));
var createSolrClient = require('solr-client').createClient;

var MLT_DEFAULTS = {
  mindf: 1,
  mintf: 1
};


module.exports = function(options) {
  var config = options.config || require('./config');
  var logger = options.logger || require('./consoleLogger');
  var logName = 'amqp2solr-solrResource';
  var credentials = config.get('private:SOLR_CREDENTIALS');

  options = _.defaults(options || {}, {
    core: '', // model name
    fields: { _id: 'id', email: 'email_ss' }, // optional field name mapping
    transformations: {} // { fieldName: { toSolr: fn, fromSolr: fn }
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

  function add(doc, cb) {
    if (!doc) {
      var err = new Error('solrResource.noDocument');
      if (cb) { cb(err); }
      return err;
    }
    var req = solr.add(doc, function(err, res) {
      logger[err ? 'error' : 'info'](logName, {
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
            logger[err ? 'error' : 'info'](logName, {
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
        logger[err ? 'error' : 'info'](logName, {
          action: 'find',
          q: q,
          core: options.core,
          err: err,
          stack: err ? err.stack : null,
          responseHandler: res ? res.responseHandler : null,
          path: req.path
        });
      }
      cb(err, err ? null : res && res.response && res.response.docs );
    });
  }

  function findAndModify(q, updateParams, cb) {
    find(q, { logging: false }, function(err, docs) {
      if (err) {
        logger.error(logName, {
          action: 'findAndModify',
          q: q,
          updateParams: updateParams,
          core: options.core,
          err: err,
          stack: err ? err.stack : null
        });
        return cb ? cb(err) : err;
      }
      if (docs && docs.length) {
        docs = _(docs).map(function(doc) {
          return _.assign(_.omit(doc, '_version_'), updateParams);
        }).value();
        updateRaw(docs, { logging: false }, function(err, addResult) {
          logger[err ? 'error' : 'info'](logName, {
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

  function findAndAtomic(atomicUpdateType, doc, updateParams, cb) {
    updateRaw(_(updateParams).
        unpluck(atomicUpdateType).
        assign(typeof doc === 'object' ? doc : {id: doc}).
        value(), cb);
  }

  function moreLikeThis(q, mlt, cb) {
    if (typeof mlt === 'function') { cb = mlt; mlt = options.mlt || {}; }
    q = encode(q);
    solr.search(solr.createQuery().
        q(q).mlt(_.defaults(mlt || {}, MLT_DEFAULTS)), function(err, res) {
      logger[err ? 'error' : 'info'](logName, {
        action: 'moreLikeThis',
        core: options.core,
        err: err,
        stack: err ? err.stack : null,
        responseHandler: res ? res.responseHandler : null,
        path: req.path
      });
      cb(err, err ? null :
          _(res.moreLikeThis).pluck('docs').flatten().map(decode).value());
    });
  }

  var solrActions = {
    delete: 'deleteByQuery',
    deleteById: 'deleteByID',
    commit: 'commit'
  };
  var atomicUpdateActions = {
    update: 'set',  // update an existing field
    appendValues: 'add',
    removeValues: 'delete'
  };
  return _({
    add: add, // add a new field
    find: find, // find(q, cb),
    findAndModify: findAndModify, // findAndModify(q, updateParams, cb)
    moreLikeThis: moreLikeThis, // moreLikeThis(q, [mlt,] cb)
    recommend: moreLikeThis,
    encode: encode, // formats object to solr
    decode: decode, // decodes solr format (field name and value transformation mapping
    solr: solr
  } ).bindResource(solr, solrActions).
      bindPartials(findAndAtomic, atomicUpdateActions).
      value();
};
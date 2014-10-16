'use strict';
var _ = require('lodash');
var createSolrClient = require('solr-client').createClient;

var MLT_DEFAULTS = {
  mindf: 1,
  mintf: 1
};

module.exports = function(options) {
  options = _.defaults(options || {}, {
    // model name
    core: '',
    fields: { _id: 'id', email: 'email_ss' },
    transformations: {} /* { fieldName: { toSolr: fn, fromSolr: fn } */
  });
  var config = options.config || require('./config');


  var logger = options.logger || _(['info', 'debug', 'warning', 'error']).
      zipObject().mapValues(function(x, level){
        return _.partial(console.log, level + ':');
      }).value();
  var credentials = config.get('private:SOLR_CREDENTIALS');
  var solr = createSolrClient(
      _(options).pick('core').
          assign(config.get('private:SOLR_CONFIG')).
          value());
  solr.basicAuth(credentials.username, credentials.password);


  function transform(transformation, key, value) {
    transformation = options.transformations ?
        options.transformations[key] &&
        options.transformations[key][transformation] || null : null;
    return (transformation) ? transformation(value) : value;
  }
  function formatToSolr(doc) {
    return _.reduce(options.fields, function(acc, targetKey, sourceKey) {
      if (doc[sourceKey]) {
        acc[targetKey] = transform('toSolr', sourceKey, doc[sourceKey]);
      }
      return acc;
    }, {});
  }
  function parseFromSolr(doc) {
    return _.reduce(options.fields, function(acc, sourceKey, targetKey) {
      if (doc[sourceKey]) {
        acc[targetKey] = transform('fromSolr', targetKey, doc[sourceKey]);
      }
      return acc;
    }, {});
  }

  function find(q, cb) {
    q = formatToSolr(q);
    var req = solr.search(solr.createQuery().q(q), function(err, res) {
      logger[err ? 'error' : 'info']('amqp2solr-solr-find', {
        action: 'find',
        q: q,
        core: options.core,
        err: err,
        stack: err ? err.stack : null,
        responseHandler: res ? res.responseHandler : null,
        path: req.path
      });
      cb(err, err ? null : res.response.docs);
    });
  }

  function add(doc, cb) {
    cb = cb || _.noop;
    if (!doc) {
      cb(new Error('solrResource.noDocument'));
    }

    var req = solr.add(doc, function(err, res) {
      logger[err ? 'error' : 'info']('amqp2solr-solr-update', {
        action: 'add',
        core: options.core,
        err: err,
        stack: err ? err.stack : null,
        responseHandler: res ? res.responseHandler : null,
        path: req.path
      });

      cb(err, res);
    });
  }

  function recommend(q, mlt, cb) {
    if (typeof mlt === 'function') { cb = mlt; mlt = options.mlt || {}; }
    q = formatToSolr(q);
    solr.search(solr.createQuery().
        q(q).mlt(_.defaults(mlt || {}, MLT_DEFAULTS)), function(err, res) {
      cb(err, err ? null :
          _(res.moreLikeThis).
              pluck('docs').
              flatten().
              map(parseFromSolr).
              value());
    });
  }

  return {
    add: add, // add a document
    recommend: recommend, // recommending against a query
    find: find,
    findById: function(id, cb) {
      find({id: id}, cb);
    },
    deleteById: solr.deleteByID,
    // queueing
    encode: formatToSolr,
    decode: parseFromSolr,
    solr: solr
  };
};
'use strict';

var _ = require('lodash');
var resourceFactory = require('./solrResourceFactory');
var queueFactory = require('./queueFactory');

module.exports = function(dependencies) {
  var queue = queueFactory(dependencies);
  function getResource(options) {
    return resourceFactory(_(dependencies).
        pick('amqp', 'config', 'logger').
        assign(options).
        value());
  }

  function getQueue(queueName, solrResourceOrOptions) {
    if (solrResourceOrOptions === undefined) {
      solrResourceOrOptions = queueName;
      queueName = undefined;
    }
    if (! solrResourceOrOptions.solrResourceOptions) {
      solrResourceOrOptions = getResource(solrResourceOrOptions);
    }
    if (!queueName) {
      queueName = 'amqp2solr.' + solrResourceOrOptions.solrResourceOptions.core;
    }

    return _(solrResourceOrOptions).mapValues(function (v, action) {
      return _.partial(queue.publish, action, queueName);
    }).assign({
      resource: solrResourceOrOptions,
      listen: _.partial(queue.listen, queueName, solrResourceOrOptions)
    }).value();
  }

  function getAsymmetric() {
    var q = getQueue.apply(null, arguments);
    return _.assign(q, _.omit(q.resource, resourceFactory.setters));
  }

  return {
    getResource: getResource,
    getQueue: getQueue,
    getAsymmetric: getAsymmetric
  };
};
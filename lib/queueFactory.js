'use strict';
var _ = require('jstk').bind(require('lodash'));

//var NON_PERSISTENT_DELIVERY = 1;
var PERSISTENT_DELIVERY = 2;
var persistentQueue = { durable: true, mandatory: true, autoDelete: false };

var self = function(dependencies) {
  dependencies = dependencies || {};
  var amqp = dependencies.amqp || require('amqp');
  var config = dependencies.config;
  var logger = dependencies.logger || require('./consoleLogger');
  var ready = false;
  var internalQueue = [];

  var rabbitmq = amqp.createConnection(config.get('private:AMQP_CONNECTION'));
  rabbitmq.on('ready', function() {
    ready = true;
    logger.info('amqp2solr-rabbitmq-ready');
    _.each(internalQueue, function(q) {
      publish.apply(null, [q.action, q.queue].concat(q.args));
    });
    internalQueue = [];
  });
  rabbitmq.on('error', function() {
    if (ready) {
      logger[ready ? 'error' : 'debug']('amqp2solr-rabbitmq-error', {
        arguments: arguments
      });
    }
    ready = false;
  });
  rabbitmq.on('close', function() {
    if (ready) {
      logger[ready ? 'error' : 'debug']('amqp2solr-rabbitmq-close', {});
    }
    ready = false;
  });

  function listen(queueName, solrResource, cb) {
    if (ready) {
      rabbitmq.queue(queueName, persistentQueue, function(q) {
        logger.info('amqp2solr-listening', { queue: queueName });
        q.subscribe(function(message, headers, deliveryInfo) {
          solrResource[message.action].apply(null, message.args);
          logger.info('amqp2solr-message', {
            action: message.action,
            queue: queueName,
            message: message,
            headers: headers,
            deliveryInfo: deliveryInfo
          });
          if (cb) {
            cb(null, message, headers, deliveryInfo);
          }
        });
      });
    } else {
      rabbitmq.on('ready', function() {
        listen(queueName, solrResource, cb);
      });
    }
  }

  function publish(action, queue) {
    var args = _.sortArgs(arguments).slice(2);
    if (ready) {
      rabbitmq.publish(queue, JSON.stringify({
        action: action,
        args: args
      }), {
        deliveryMode: PERSISTENT_DELIVERY,
        contentType: 'application/json',
        timestamp: Date.now()
      });
    } else {
      internalQueue.push({ queue: queue, action: action, args: args });
    }
    logger.info({delayed: !ready, action: action, queue: queue, args: args });
  }

  return { listen: listen, publish: publish };
};

module.exports = self;
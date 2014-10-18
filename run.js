var _ = require('lodash');
var amqp2solr = require('./lib')({
  config: require('./lib/config'),
  logger: require('./lib/consoleLogger')
});

var blogQueue = amqp2solr.getAsymmetric({
  core: 'blogs',
  fields: {
    tumblrUsername: 'id',
    email: 'email_s',
    createdAt: 'createdAt_dt',
    updatedAt: 'updatedAt_dt',
    hashtags: 'hashtags_ss',
    images: 'images_ss'
  },
  transformations: {
    hashtags: {
      toSolr: function toSolr(value) {
        return _.pluck(value, 'label');
      },
      fromSolr: function fromSolr(value) {
        return _.map(value, function (tag) {
          return { label: tag, origin: 'solr' };
        });
      }
    }
  },
  mlt: {
    fl: "hashtags_ss",
    count: 100
  }
});
//var blogResource = blogQueue.resource;
blogQueue.listen();

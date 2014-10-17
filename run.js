var _ = require('lodash');
var amqp2solr = require('./lib')({
  config: require('./lib/config'),
  logger: require('./lib/consoleLogger')
});

var blogQueue = amqp2solr.getQueue({
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
        return {
          label: value,
          origin: 'solr'
        };
      }
    }
  },
  mlt: {
    fl: "hashtags_ss",
    count: 100
  }
});
blogQueue.listen();
blogQueue.createOrUpdate({id: 'phossquazzahl'}, { phosskazal_i:  10 });
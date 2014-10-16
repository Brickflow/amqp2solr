'use strict';
var _ = require('lodash');
var config = require('./lib/config');
var amqp2solr = require('./lib/amqp2solr')({ config: config });

var blogResource = amqp2solr.getResource({
  core: 'blogs',
  fields: {
    tumblrUsername: 'id',
    email: 'email_s',
    createdAt: 'createdAt_dt',
    updatedAt: 'updatedAt_dt',
    hashtags: 'hashtags_ss'
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
    fl: "hashtags_ss"
  }
});

//amqp2solr.update('solr-blog', blogResource.encode({
//  tumblrUsername: 'ifroz',
//  email: 'ifrozen@gmail.com',
//  createdAt: new Date(),
//  updatedAt: new Date(),
//  hashtags: [{label: 'milf'}, {label: 'pron'}]
//}));
//
amqp2solr.listen('solr-blog', blogResource, function(err, queue) {
  console.log('solr-q-mock', err, queue);
});

blogResource.recommend({tumblrUsername: 'ifroz'}, function() {
  console.log('recommend', arguments);
});

blogResource.find({tumblrUsername: 'ifroz'}, function(err, res) {
  console.log('MI SELF', err, res);
});

//blogResource.solr.commit(function(err, res) {
//  console.log(err, res);
//});
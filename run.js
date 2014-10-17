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
    fl: "hashtags_ss"
  }
});

//blogResource.solr.commit();
//blogResource.findAndModify({ id: 'ifroz' }, { foskazal_i: 5 }, function() {
//  console.log('VISSZAJOTT ANYAD IS', arguments);
//});


amqp2solr.findAndModify('solr-blog', 'ifroz', blogResource.encode({
  updatedAt: new Date(),
  akarmi_ss: ['loafszkarikaBhazzzegTeFOSKAZAL'],
//  images: [
//    "http://36.media.tumblr.com/f68bdd0321ded9e83b1aa18ba7a403d5/tumblr_nb2iorwmS21qzbl5oo1_400.jpg",
//    "http://36.media.tumblr.com/dc2fa235f4398b2c12ae8fbd91c65903/tumblr_nb19nobi0b1rhavdko1_250.png",
//    "http://38.media.tumblr.com/814624703aecc97e7326b7fea2c62849/tumblr_ncyxlm3Idw1rgygrxo2_250.gif",
//    "http://36.media.tumblr.com/0c9af6027d5f1a4b42bc65807b1a4f86/tumblr_mh06k2VPSd1qahheuo1_r1_400.jpg",
//    "http://33.media.tumblr.com/fdfcedebe6a3f1d41f0ea9d888770017/tumblr_nc9kuxzDKg1r7ealro1_400.jpg",
//    "http://38.media.tumblr.com/c7ca75501b9314b294ea5f869a93f585/tumblr_nbsvqiNDLC1qz8q0ho1_250.gif",
//    "http://40.media.tumblr.com/1127b0552c282fe4eeb9905dbc410131/tumblr_nbwu79kiJ91r7ealro2_r3_400.jpg",
//    "http://40.media.tumblr.com/fe5e2386a7bc3e624c107fe5718368ca/tumblr_mt5eq3RSsH1r7ealro1_r1_400.jpg",
//    "http://38.media.tumblr.com/9e5868d551c81e4a51fcb2b970a34c25/tumblr_ncdxkieikS1r7ealro1_400.gif"
//  ]
  hashtags: [{ label: 'milf' }, { label: 'porn' }, {label: 'booobies'}, {label: 'bitches'}]
}));

amqp2solr.listen('solr-blog', blogResource, function(err, queue) {
  console.log('solr-q-mock', err, queue);
});
//

//blogResource.recommend({tumblrUsername: 'ifroz'}, function() {
//  console.log('recommend', arguments);
//});
//
//blogResource.find({tumblrUsername: 'ifroz'}, function(err, res) {
//  console.log('MI SELF', err, res);
//});

//blogResource.solr.commit(function(err, res) {
//  console.log(err, res);
//});
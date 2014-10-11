var nconf = require('nconf');

var ENV = process.env.AMPQ2SOLR_ENVIRONMENT || 'DEV';
var lowerEnv = ENV.toLowerCase();

nconf.add('local', {
  type: 'file',
  file: './config/local.json'
});

nconf.add(lowerEnv, {
  type: 'file',
  file: './config/' + lowerEnv + '.json'
});

nconf.add('global', {
  type: 'file',
  file: './config/global.json'
});

nconf.set('ENVIRONMENT', ENV.toUpperCase());

module.exports = nconf;


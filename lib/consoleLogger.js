var _ = require('lodash');
module.exports =
    _(['info', 'debug', 'warning', 'error']).
        zipObject().
        mapValues(function(x, level){
          return _.partial(console.log, level + ':');
        }).value();
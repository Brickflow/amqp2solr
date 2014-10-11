# amqp2solr([dependencies])

amqp2solr is a library both for querying a SOLR core and queueing (add) queries for delayed execution.

Some dependencies can be injected if you wish, e.g.:

    var config = {
      get: function(key) {
        return {
          'private:AMQP_CONNECTION': {},
          'private:SOLR_CREDENTIALS: {username, password},
          'private:SOLR_CONFIG': {host, core ...}
        }[key];``
      }
    }
    
    var _ = require('lodash');
    var logger = dependencies.logger || _(['info', 'debug', 'warning', 'error']).
      zipObject().mapValues(function(x, level) {
    return _.partial(console.log, level + ':');
    }).value();

The dependencies parameter can be used for overriding ``amqp``, ``config`` or ``logger``.

- ``logger`` should have ``info``, ``error`` and ``debug`` methods. It defaults to console.log.
- ``config`` assumed to have a ``get`` method. (nconf is used)

    var amqp2solr = require('amqp2solr')({ config, logger });

## ampq2solr.getResource(options)

Returns a SOLR resource instance. 

The options parameter accepts the following fields

- ``core``: the name of the core to connect to, defaults to ``''``
- ``fields``: an object consisting of key-value pairs to transform field names.
  - it's keys are keys of your existing model
  - it's values are field names in SOLR
  - Typically, this can be used to adapt to the default solr schema.xml, eg: ``{email: 'email_s'}``
  - Currently, all the fields need to be defined here, not only the mapped ones.
- ``transformations`` is an object which can be used for traversing data before/after solr.
  - it's keys are keys of your existing model
  - it's values are objects with 2 fields:
  - ``formSolr: function(value) {return value; }``
  - ``toSolr: function(value) {return value; }``

  
    amqp2solr.getResource(options);
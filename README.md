# amqp2solr
amqp2solr is a library both for querying a SOLR core and queueing (add) queries for delayed execution. 
It is a wrapper, which aims to make delayed/remote execution of solr queries more seamless.

## Usage
    var amqp2solr = require('amqp2solr')({ config, logger });
    
    // Create a resource
    var blogResource = amqp2solr.getResource({ 
      ...
    });
    
    // HOST A: Send delayed queries
    amqp2solr.update(QUEUE_NAME, blogResource.encode(document));
    // ... which is identical to ...
    amqp2solr.publish('add', QUEUE_NAME, blogResource.encode(document))
    
    
    // HOST B: The daemon/listener/server
    amqp2solr.getResource({
      
    });
    
    

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

### ampq2solr.getResource(options)
Returns a solrResource instance. 

The options parameter accepts the following fields:

- ``core``: the name of the core to connect to, defaults to ``''``
- ``fields``: an object consisting of key-value pairs to transform field names.
  - it's keys are keys of your existing model
  - it's values are field names in SOLR
  - Typically, this can be used to adapt to the default solr schema.xml, eg: ``{email: 'email_s'}``
  - Currently, all the fields need to be defined here, not only the mapped ones.
- ``transformations`` is an optional object which can be used for transforming the data before/after solr.
  - it's keys are keys of your existing model
  - it's values are objects with 2 fields:
  - ``formSolr: function(value) {return value; }``
  - ``toSolr: function(value) {return value; }``
- ``mlt`` is an optional more like this setting to be used as default in the ``recommend`` method.

It return an object with the following methods:

- ``add(doc, cb)`` adds a document to the core
- ``recommend(q, [mlt,] cb)`` runs a moreLikeThis query, mlt defaults to ``options.mlt`` if none given
- ``find(q, cb)`` finds some fields
- ``findById(id, cb)`` finds by id
- ``deleteById(id, cb)`` deletes by id
- ``encode`` formats the document to solr (transposes field names and performs transformations)
- ``deocde`` formats the document came back from solr (reverses field names and performs reverse transformations)
- ``solr`` exposes the wrapped ``node-solr-client``

### amqp2solr.listen(queueName, solrResource[, cb])
This function listens to the queue ``queueName`` on it's AMQP connection and processes queries sent via amqp2solr.

### amqp2solr.publish(action, queueName, payload)
Sends a message to the queue which the listener will respond to like doing:  ``solrResource[action](payload)``

### amqp2solr.add(queueName, solrResource.encode(document))
Queues the addition of the document
solrResource.encode is neccessary for the field mapping and transformations to take place.
 
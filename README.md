# amqp2solr
amqp2solr is a library both for querying a SOLR core and queueing (add) queries for delayed execution. 
It is a wrapper, which aims to make delayed/remote execution of solr queries more seamless.

## Basic usage

    var config = {
      get: function(key) {
        return {
          'private:AMQP_CONNECTION': {},
          'private:SOLR_CREDENTIALS: {username, password},
          'private:SOLR_CONFIG': {host, ... }
        }[key];
      }
    };
    var dependencies = { config, logger, amqp };
    
    var amqp2solr = require('amqp2solr')(dependencies);
    
    var resourceParams = { core: 'blogs' };
    
The dependencies parameter can be used for overriding ``config`` and/or ``logger``.

- ``logger`` should have ``info``, ``error`` and ``debug`` methods. It defaults to console.log.
- ``config`` assumed to have a ``get`` method. (nconf is used)

### ``getResource(options)`` and query locally

    var blogResource = amqp2solr.getResource(resourceParams);
    blogResource.add({id: 'example', someField: 1}, cb);
    blogResource.createOrUpdate({id: 'example'}, {someOtherField: 1}, cb);

### ``getQueue([queueName,] blogResourceOrDescriptor)`` and queue queries 

    // Create a resource ...
    var blogResource = amqp2solr.getResource(resourceParams);
    
    // ... and map it to the resource ...
    var blogQueue = amqp2solr.getQueue(blogResource);
    // ... optionally with explicitly given AMQP queue name ...
    var blogQueue = amqp2solr.getQueue(queueName, blogResource);
    
You can give resourceParams instead of an actual resource (can be useful in environments where you don't want to use the resource locally.
    
    var blogQueue = amqp2solr.getQueue(queueName, resourceParams);
    
You can get the resource ``var blogResource = blogQueue.resource;``.
### ``solrQueue.listen()`` to a queue and parse 
    
    amqp2solr.getQueue(queueName, resourceParams).listen(); 

## ``ampq2solr.getResource(options)``
Returns a solrResource instance. 

The options parameter accepts the following fields:

- ``core``: the name of the core to connect to, defaults to ``''``
- ``fields``: an object consisting of key-value pairs to transform field names.
  - it's keys are keys of your existing model
  - it's values are field names in SOLR
  - Typically, this can be used to adapt to the default solr schema.xml, eg: ``{email: 'email_s'}``
- ``transformations`` is an optional object which can be used for transforming the data before/after solr.
  - it's keys are keys of your existing model
  - it's values are objects with 2 fields:
  - ``formSolr: function(value) {return value; }``
  - ``toSolr: function(value) {return value; }``
- ``mlt`` is an optional more like this setting to be used as default in the ``recommend`` method.

It returns a ``solrResource`` object;

## ``amqp2solr.getQueue([queueName,] solrResourceOrOptions)``

Returns a ``solrQueue`` instance. If solrResourceOrOptions is not a 
solrResource,
it calls getResource with solrResourceOrOptions.

## ``solrQueue``

``solrQueue`` has exactly the same methods than a ``solrResource``, but it pushes the task to the queue rather than executing it locally.

## ``solrResource``
- ``add(doc [,cb])``: creates/replaces a document
- ``find(q [,cb])``: find documents both by query or id
- ``findAndModify(q, updateParams [, opts ,cb])``: update some fields of existing documents matched by ``find(q)``
- ``createOrUpdate(q, updateParams, [, cb])``: similar to ``findAndModify``, but this creates a new document if none found.
- ``moreLikeThis(q, [mlt], cb)``: find similar documents to any document which matches
- ``delete(id, cb)`` deletes by a query, mapped from ``node-solr-client``
- ``deleteById(id, cb)`` deletes by id
- ``encode`` formats the document to solr (transposes field names and performs transformations)
- ``deocde`` formats the document came back from solr (reverses field names and performs reverse transformations)
- ``solr`` exposes the wrapped ``node-solr-client`` 
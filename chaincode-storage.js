const shim = require('fabric-shim');
const ClientIdentity = require('fabric-shim').ClientIdentity;

const logger = shim.newLogger('StorageChaincode');

module.exports = class StorageChaincode {

  async Init(stub) {
    let req = stub.getFunctionAndParameters();
    logger.info("Init on %s with %j", stub.getChannelID(), req);
    return shim.success(Buffer.from(''));
  }

  async Invoke(stub) {
    let req = stub.getFunctionAndParameters();
    this.channel = stub.getChannelID();

    // use either methods to get transaction creator org and identity
    let cid = new ClientIdentity(stub);
    // logger.info("by %s %s %j", cid.mspId, cid.id, cid.cert);
    // let creator = stub.getCreator();
    // logger.info("by %s", creator.mspid);
    this.creator = cid;
    this.creator.org = cid.mspId.split('MSP')[0];

    logger.info("Invoke on %s by %s with %j", this.channel, this.creator.org, req);

    /*let method = this[req.fcn];
    if (!method) {
      return shim.error(Buffer.from(`no method found of name: ${req.fcn}`));
    }

    method = method.bind(this);*/

    try {
      // let payload = await method(stub, req.params);

      let payload;
      if(req.fcn === 'put') {
        payload = await this.put(stub, req.params);
      }
      else if(req.fcn === 'get') {
        payload = await this.get(stub, req.params);
      }
      else if(req.fcn === 'delete') {
        payload = await this.delete(stub, req.params);
      }
      else if(req.fcn === 'list') {
        payload = await this.list(stub, req.params);
      }
      else if(req.fcn === 'range') {
        payload = await this.range(stub, req.params);
      }

      return shim.success(payload);
    } catch (err) {
      logger.error(err);
      return shim.error(err);
      // return shim.error(`caught ${err.name} ${err.message}`);
    }
  }

  async get(stub, args) {
    let key = toKey(stub, args);

    return await stub.getState(key);
  }

  async put(stub, args) {
    let req = toKeyValue(stub, args);

    await stub.putState(req.key, Buffer.from(req.value));
  }

  async range(stub, args) {
    let startKey = '', endKey = '';
    if(args.length > 0){
      startKey = args[0];
    }
    if(args.length > 1) {
      endKey = args[1];
    }

    let iter = await stub.getStateByRange(startKey, endKey);

    return await toQueryResult(iter);
  }

  async list(stub, args) {
    if(args.length < 1) {
      throw new Error('incorrect number of arguments, objectType is required');
    }

    let objectType = args[0];
    let attributes = args.slice(1);

    logger.debug('list args=%j objectType=%j, attributes=%j', args, objectType, attributes);

    let iter = await stub.getStateByPartialCompositeKey(objectType, attributes);

    return await toQueryResult(iter);
  }

  async delete(stub, args) {
    let key = toKey(stub, args);

    await stub.deleteState(key)
  }

  setEvent(stub, name, args) {
    stub.setEvent(name, Buffer.from(JSON.stringify(args)));
  }
};

async function toQueryResult(iter) {
  let ret = [];
  while(true) {
    let res = await iter.next();

    if(res.value && res.value.value.toString()) {
      let jsonRes = {};

      jsonRes.key = res.value.key;
      try {
        jsonRes.value = JSON.parse(res.value.value.toString('utf8'));
      } catch (err) {
        jsonRes.value = res.value.value.toString('utf8');
      }
      ret.push(jsonRes);
    }

    if(res.done) {
      await iter.close();
      return Buffer.from(JSON.stringify(ret));
    }
  }
}

function toKey(stub, args) {
  let k;
  if(args.length < 1) {
    throw new Error('incorrect number of arguments, key is required');
  }
  else if(args.length === 1) {
    k = args[0];
  }
  else if(args.length > 1) {
    let objectType = args[0];
    let attributes = args.slice(1);

    k = stub.createCompositeKey(objectType, attributes);
  }

  return k;
}

function toKeyValue(stub, args) {
  let k, v;
  if(args.length < 2) {
    throw new Error('incorrect number of arguments, key and value are required');
  }
  else if(args.length === 2) {
    k = args[0];
    v = args[1];
  }
  else if(args.length > 2) {
    let objectType = args[0];
    let attributes = args.slice(1, args.length-1);

    k = stub.createCompositeKey(objectType, attributes);
    v = args[args.length-1];
  }

  return {key: k, value: v};
}
var TType = {
  STOP   : 0,
  VOID   : 1,
  BOOL   : 2,
  BYTE   : 3,
  DOUBLE : 4,
  I16    : 6,
  I32    : 8,
  I64    : 10,
  STRING : 11,
  STRUCT : 12,
  MAP    : 13,
  SET    : 14,
  LIST   : 15,
  ENUM   : 16
};

var TName = function(tType) {
  for (t in TType) {
    if (TType[t] == tType) {
      return t;
    }
  }
}

var I16_MAX = 32767;
var I32_MAX = 2147483647;
var I64_MAX = Big('9223372036854775807');
var I64_UMAX = Big('18446744073709551616');
var VERSION_MASK = 0xffff0000;
var VERSION_1 = 0x80010000;

var TBuffer = function TBuffer(uint8array) {
  this.buf = uint8array;
  this.idx = 0;

  this.readByte = function() {
    if (this.idx >= this.buf.length) {
      throw 'Unexpected end of buffer';
    }
    var res = this.buf[this.idx];
    this.idx += 1;
    return res;
  }

  this.readI16 = function() {
    var res = this.readByte();
    res = (res << 8) + this.readByte();
    console.log(res.toString(2))
    if (res > I16_MAX) {
      return I16_MAX - res;
    } else {
      return res;
    }
  }

  this.readI32 = function() {
    var res = 0;
    for (var i = 0; i < 4; i++) {
      res = (res << 8) + this.readByte();
    }
    console.log(res.toString(2))
    if (res > I32_MAX) {
      return I32_MAX - res
    } else {
      return res;
    }
  }

  // NB: always returns a Big
  this.readI64 = function() {
    var res = new Big(0);
    for (var i = 0; i < 8; i++) {
      res = res.times(256).plus(this.readByte());
    }
    console.log(res.toString())
    if (res.gt(I64_MAX)) {
      return res.minus(I64_UMAX);
    } else {
      return res;
    }
  }

  this.readDouble = function() {
    var reversed = new Array(8);
    // No Uint8Array.reverse in chrome
    for (var i = reversed.length - 1; i >= 0; i--) {
      reversed[i] = this.readByte();
    }
    var dArr = new Float64Array(new Uint8Array(reversed).buffer);
    return dArr[0];
  }

  this.read = function(bytes) {
    if (this.idx + bytes > this.buf.length || bytes < 0) {
      throw 'Unexpected end of buffer';
    }
    var res = this.buf.subarray(this.idx, this.idx + bytes);
    this.idx += bytes;
    return res;
  }
}

var TMap = function TMap(kType, vType, size) {
  this.kType = kType;
  this.vType = vType;
  this.size = size;
  this.entries = [];
  this.read = function(proto) {
    for (var i = 0; i < this.size; i++) {
      var entry = {
        k: proto.readValue(kType),
        v: proto.readValue(vType)
      }
      this.entries.push(entry);
    }
    return this.entries;
  }
}

var TList = function TList(eType, size) {
  this.eType = eType;
  this.size = size;
  this.list = [];
  this.read = function(proto) {
    for (var i = 0; i < this.size; i++) {
      this.list.push(proto.readValue(eType));
    }
    return this.list;
  }
}

var TStruct = function TStruct() {
  this.fields = {};
  this.read = function(proto) {
    while(true) {
      var tField = proto.readField();
      if (tField.fType != TType.STOP) {
        this.fields["" + tField.id] = tField.read(proto);
      } else {
        return this.fields;
      }
    }
  }
}

var TField = function TField(fType, id) {
  this.fType = fType;
  this.id = id;
  this.read = function(proto) {
    if (this.fType != TType.STOP) {
      return proto.readValue(this.fType)
    }
  }
}


var TMessage = function TMessage(name, mType, seqId) {
  this.name = name;
  this.mType = mType;
  this.seqId = seqId;

  this.read = function(proto) {
    var tStruct = new TStruct();
    return [ name, mType, seqId, tStruct.read(proto) ];
  }
}

// from http://stackoverflow.com/questions/17191945/conversion-between-utf-8-arraybuffer-and-string
function uintToString(uintArray) {
  var encodedString = String.fromCharCode.apply(null, uintArray);
  return decodeURIComponent(escape(encodedString));
}

var TBinaryProtocol = function TBinaryProtocol(tBuffer) {
  this.stop = { stop: true };
  this.tBuffer = tBuffer;
  this.readField = function() {
    var fType = this.tBuffer.readByte();
    var id = 0;
    if (fType != TType.STOP) {
      id = this.tBuffer.readI16();
    }
    var tField = new TField(fType, id);
    console.log('fld ' + fType + ' ' + id);
    return tField;
  }

  this.readMessage = function() {
    var size = this.tBuffer.readI32();
    if (size < 0) {
      var version = size & VERSION_MASK;
      var name = this.readString();
      var seqId = this.tBuffer.readI32();
      var tMsg = new TMessage(name, size & 0x000000ff, seqId);
      return tMsg.read(this);
    } else {
      var tMsg = new TMessage(this.readString(), this.readByte(), this.readI32());
      return tMsg.read(this);
    }
  }

  this.readStruct = function() {
    var tStruct = new TStruct();
    return tStruct.read(this);
  }

  this.readMap = function() {
    var kType = this.tBuffer.readByte();
    var vType = this.tBuffer.readByte();
    var size = this.tBuffer.readI32();
    var tMap = new TMap(kType, vType, size);
    console.log('map ' + TName(kType) + ' ' + TName(vType) + ' ' + size);
    return tMap.read(this);
  }

  this.readList = function() {
    var eType = this.tBuffer.readByte();
    var size = this.tBuffer.readI32();
    var tList = new TList(eType, size);
    console.log('lst ' + TName(eType) + ' ' + size);
    return tList.read(this);
  }

  this.readString = function() {
    var size = this.tBuffer.readI32();
    var strBuf = this.tBuffer.read(size);
    var str = '';
    try {
      str = uintToString(strBuf);
    } catch(e) {
      str = 'unknown: ';
      for (var i = 0; i < size; i++) {
        str += strBuf[i].toString(16);
      }
    }
    console.log('str ' + str);
    return str;
  }

  this.readValue = function(tType) {
    console.log('readValue ' + TName(tType));
    switch(tType) {
      case TType.STOP:
        throw 'Unexpected read of a STOP'
        break;
      case TType.STOP:
        throw 'Unexpected read of a VOID'
        break;
      case TType.BOOL:
        return this.tBuffer.readByte() == 1;
        break;
      case TType.BYTE:
        return this.tBuffer.readByte();
        break;
      case TType.DOUBLE:
        return this.tBuffer.readDouble();
        break;
      case TType.I16:
        return this.tBuffer.readI16();
        break;
      case TType.I32:
      case TType.ENUM:
        return this.tBuffer.readI32();
        break;
      case TType.I64:
        return this.tBuffer.readI64().toString() + 'L';
        break;
      case TType.MAP:
        return this.readMap();
        break;
      case TType.STRING:
        return this.readString();
        break;
      case TType.SET:
      case TType.LIST:
        return this.readList();
        break;
      case TType.STRUCT:
        return this.readStruct();
        break;
      default:
        debugger;
    }
  }
}

var hex2bin = function(str) {
  var strHex = str.replace(/[^a-fA-F0-9]/g, '');
  var bin = new Uint8Array(strHex.length / 2);
  for (var i = 0; i < strHex.length / 2; i ++) {
    bin[i] = parseInt(strHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bin;
}


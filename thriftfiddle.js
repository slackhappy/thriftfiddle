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

var I16_MAX = 32767
var I32_MAX = 2147483647

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
    var res = this.readByte();
    res = (res << 8) + this.readByte();
    res = (res << 8) + this.readByte();
    res = (res << 8) + this.readByte();
    console.log(res.toString(2))
    if (res > I32_MAX) {
      return I32_MAX - res
    } else {
      return res;
    }
  }

  this.read = function(bytes) {
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
      case TType.MAP:
        return this.readMap();
        break;
      case TType.STRING:
        return this.readString();
        break;
      case TType.LIST:
        return this.readList();
        break;
      case TType.STRUCT:
        return this.readStruct();
        break;
      case TType.I16:
        return this.tBuffer.readI16();
        break;
      case TType.I32:
        return this.tBuffer.readI32();
        break;
      case TType.BYTE:
        return this.tBuffer.readByte();
        break;
      case TType.BOOL:
        return this.tBuffer.readByte() == 1;
        break;
      default:
        debugger;
    }
  }
}

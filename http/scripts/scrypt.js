var scrypt = scrypt_module_factory();

scrypt.hex2uint8array = function(hex) {
	var bytes = new Uint8Array(hex.length/2);
	for(var i=0; i< hex.length-1; i+=2){
	    bytes[i] = parseInt(hex.substr(i, 2), 16);
	}
	return bytes;
}

scrypt.createHash = function(data, config) {
	var hash = scrypt.crypto_scrypt(scrypt.encode_utf8(data), scrypt.hex2uint8array(config.salt), config.n, config.r, config.p, config.keyLength);
    return scrypt.to_hex(hash);	
}


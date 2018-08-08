var cryptoUtility = require('./crypto-utility.js')

function setStorage(values, callback) {
    chrome.storage.local.set(values, callback);
}

function getStorage(key, callback) {
    chrome.storage.local.get(key, callback);
}

function getChannels(callback) {
    getStorage({channels: []}, function(result) {
        callback(null, result.channels);
    })
}

function setChannels(channels, callback) {
    setStorage({channels: channels}, function() {
        callback();
    })
}

function getCurrentAccount(callback) {
    getStorage({accounts: []}, function(result) {
        if (result.accounts.length > 0) {
            callback(null, result.accounts[0]);
        } else {
            callback(new Error("No accounts"), null);
        }
    })
}

function getAccounts(password, callback) {
    getStorage({accounts: ""}, function (result) {
        var encrypted = result.accounts;
        if (encrypted) {
            try {
                var decrypted = cryptoUtility.decrypt(password, encrypted);
                var accounts = JSON.parse(decrypted);
                if (Array.isArray(accounts)) {
                    console.log("Decrypted")
                    callback(null, accounts);
                } else {
                    console.log("Not Decrypted");
                    callback("Not decrypted", accounts);
                }
            } catch (e) {
                console.log("Failed to parse decrypted json");
                callback("Incorrect password", []);
            }
        } else {
            console.log("Nothing stored")
            callback(null, encrypted);
        }
    })
}

function setAccounts(password, accounts, callback) {
    var encrypted = cryptoUtility.encrypt(password, JSON.stringify(accounts));
    setStorage({accounts: encrypted}, function () {
        callback();
    })
}

function clearAccounts(callback) {
    setStorage({accounts: ""}, function () {
        callback();
    })
}

function getTopHeader(callback) {
    getStorage({topHeader: 0}, function(result) {
        callback(null, result.topHeader);
    })
}

function getHeaders(callback) {
    getStorage({headers: {}}, function(result) {
        callback(null, result.headers);
    })
}

function setTopHeader(topHeader, callback) {
    setStorage({topHeader: topHeader}, function() {
        callback();
    })
}

function setHeaders(headersDb, callback) {
    setStorage({headers: headersDb}, function() {
        callback();
    })
}

function getConnectionInfo(callback) {
    getStorage({connectionInfo: {url: "168.62.52.179", port: 8080}}, function (result) {
        callback(null, result.connectionInfo);
    });
}

function setConnectionInfo(info, callback) {
    setStorage({connectionInfo: info}, function() {
        callback();
    });
}

function hasPasswordBeenSet(callback) {
    getStorage({passwordBeenSet: false}, function (result) {
        callback(null, result.passwordBeenSet);
    });
}

function setPasswordBeenSet(beenSet, callback) {
    setStorage({passwordBeenSet: beenSet}, function() {
        callback();
    });
}

exports.set = setStorage;
exports.get = getStorage;
exports.getChannels = getChannels;
exports.setChannels = setChannels;
exports.getCurrentAccount = getCurrentAccount;
exports.getTopHeader = getTopHeader;
exports.setTopHeader = setTopHeader;
exports.setHeaders = setHeaders;
exports.getHeaders = getHeaders;
exports.getAccounts = getAccounts;
exports.setAccounts = setAccounts;
exports.clearAccounts = clearAccounts;
exports.getConnectionInfo = getConnectionInfo;
exports.setConnectionInfo = setConnectionInfo;
exports.hasPasswordBeenSet = hasPasswordBeenSet;
exports.setPasswordBeenSet = setPasswordBeenSet;
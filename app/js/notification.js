var NotificationManager = require('./lib/notification-manager.js');
var notificationManager = new NotificationManager();
const { pull_channel_state } = require('./ui/spk');
const formatUtility = require('./lib/format-utility');
const storage = require('./lib/storage');
const userController = require('./controller/user-controller');
const passwordController = require('./controller/password-controller');
const merkle = require('./lib/merkle-proofs');
const network = require('./controller/network-controller');

const fee = 152050;

var ec = new elliptic.ec('secp256k1');

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    console.log(results);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2]);
}

if (getParameterByName('type') === "channel") {
    initChannel();
} else if (getParameterByName('type') === "market") {
    initBet();
} else if (getParameterByName('type') === "cancel") {
    initCancel();
}

function setTitle(title) {
    document.getElementById("notification-title").innerHTML = title;
}

function initChannel() {
    setTitle("New Channel");

    //xss safety
    var div = document.createElement('div');
    div.setAttribute('data-ip', getParameterByName('ip'));
    var ip = div.getAttribute('data-ip');
    div.setAttribute('data-duration', getParameterByName('duration'));
    var duration = div.getAttribute('data-duration');
    div.setAttribute('data-locked', getParameterByName('locked'));
    var locked = div.getAttribute('data-locked');
    div.setAttribute('data-delay', getParameterByName('delay'));
    var delay = div.getAttribute('data-delay');

    var ipInput = document.getElementById('channel-ip-address');
    ipInput.innerHTML = ip;
    var lockedInput = document.getElementById('new-channel-amount');
    lockedInput.innerHTML = locked;
    var delayInput = document.getElementById('new-channel-delay');
    delayInput.innerHTML = delay;
    var lengthInput = document.getElementById('new-channel-length');
    lengthInput.innerHTML = duration;

    document.getElementById('new-channel-container').classList.remove('hidden');

    document.getElementById('cancel-channel-button').onclick = function() {
        notificationManager.closePopup();
    };

    document.getElementById('channel-advanced-button').onclick = function() {
        document.getElementById('channel-advanced-container').classList.remove('hidden');
    };

    network.send(["time_value"], function(error, timeValue) {
        initFee(timeValue);

        var channelButton = document.getElementById('create-channel-button');
        channelButton.onclick = function() {
            var locked = safeFloat(lockedInput.value);
            var delay = safeFloat(delayInput.value);
            var length = safeFloat(lengthInput.value);

            if (locked === 0 || delay === 0 || length === 0) {
                showChannelError("Fields may not be 0.")
            } else {
                makeChannel(locked, delay, length, timeValue);
            }
        }
    });
}

function safeFloat(f) {
    var val = parseFloat(f);
    if (isNaN(val)) {
        val = 0;
    }
    return val;
}

function reloadWeb() {
    chrome.tabs.query({}, function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            if (tab.url.indexOf("localhost:8000") !== -1 || tab.url.indexOf("amoveobook") !== -1) {
                chrome.tabs.reload(tab.id);
            }
        }
    });
}

function showChannelError(message) {
    var error = document.getElementById("new-channel-error-text");
    error.classList.remove("invisible");
    error.innerHTML = message;
}

function showBetError(message) {
    var error = document.getElementById("bet-error-text");
    error.classList.remove("invisible");
    error.innerHTML = message;
}

function initFee(timeValue) {
    function updateFee() {
        var timeValueFee = timeValue / 100000000;
        var amount = parseFloat(document.getElementById('new-channel-amount').value);
        if (isNaN(amount)) {
            amount = 0;
        }
        var length = parseFloat(document.getElementById('new-channel-length').value);
        if (isNaN(length)) {
            length = 0;
        }

        var rate = document.getElementById('total-rate');
        var blocks = document.getElementById('fee-block-number');
        var locked = document.getElementById('fee-amount-number');
        var total = document.getElementById('total-fee');
        var total2 = document.getElementById('total-fee2');

        rate.innerHTML = timeValueFee;
        blocks.innerHTML = length;
        locked.innerHTML = amount;
        var totalFee = 0.0015205 + timeValueFee * amount * length;
        total.innerHTML = totalFee + " " + "VEO";
        total2.innerHTML = totalFee + " " + "VEO";
    }

    document.getElementById('new-channel-amount').oninput = updateFee;
    document.getElementById('new-channel-delay').oninput = updateFee;
    document.getElementById('new-channel-length').oninput = updateFee;

    updateFee();
}

function refresh_channels_interfaces(pubkey, callback) {
    console.log("refresh channels interfaces");
    network.send(["time_value"], function(error, x) {
        tv = x;
        refresh_channels_interfaces2(pubkey, callback);
    });
}

function refresh_channels_interfaces2(pubkey, callback) {
    console.log("server pubkey is ");
    console.log(pubkey);
    load_button.onchange = function() {return load_channels(pubkey) };
    //refresh_channels_button.onclick = function() {return refresh_channels_interfaces2(pubkey)};
    var tv_display = document.createElement("div");
    tv_display.innerHTML = translate.words("time_value").concat(": ").concat((tv).toString());

    if (read(pubkey) == undefined) {
        console.log("give interface for making channels.");
        height_button.onclick = function() { return make_channel_func(pubkey) };
        append_children(div, [height_button, amount_info, spend_amount, br(), delay_info, spend_delay, br(), lifespan_info, lifespan]);
    } else {
        console.log("give interface for making bets in channels.");
        append_children(div, [close_channel_button, br(), balance_div, channel_balance_button, br(), lightning_button, lightning_amount_info, lightning_amount, lightning_to_info, lightning_to, br(), market_title, market_link, br(), price_info, price, trade_type_info, trade_type, trade_amount_info, trade_amount, oid_info, oid, button, br(), bet_update_button, br(), br(), combine_cancel_button, br(), br(), list_bets_button, br(), bets_div]);
        lightning_button.onclick = function() { lightning_spend(pubkey); };
        channel_balance_button.onclick = function() {refresh_balance(pubkey);};
        bet_update_button.onclick = function() {
            spk_object.pull_channel_state(function() {
                refresh_channels_interfaces(pubkey);
            });
        };
        combine_cancel_button.onclick = function() {
            combine_cancel_object.main(pubkey);
        };
        close_channel_button.onclick = function() {
            close_channel_func(pubkey);
        };
        bets_object.draw();
    }
    if (callback != undefined) {
        callback();
    }
}

function initBet() {
    setTitle("Confirm Bet");

    document.getElementById('make-bet-container').classList.remove('hidden');

    var amountText = document.getElementById('bet-amount');
    var oddsText = document.getElementById('bet-price');

    var amount = parseFloat(getParameterByName('amount'));
    amountText.value = amount;
    oddsText.value = parseFloat(getParameterByName('price'));
    var side = getParameterByName('side');
    var oid = getParameterByName('oid');

    document.getElementById("bet-side").innerText = capitalize(side);

    var betButton = document.getElementById('create-bet-button');
    betButton.onclick = function() {
        var amount = parseFloat(amountText.value);
        var odds = parseFloat(oddsText.value) * 100;

        if (amount > 0 && odds > 0) {
            makeBet(amount, odds, side, oid, function() {
                reloadWeb();

                notificationManager.closePopup();
            });
        } else {
            showBetError("Values must not be 0.")
        }
    };

    document.getElementById('cancel-bet-button').onclick = function() {
        notificationManager.closePopup();
    }

    showMaxBalance(amount);
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function makeChannel(amount, delay, length, timeValue) {
    network.send(["pubkey"], function(error, pubkey) {
        // return refresh_channels_interfaces(pubkey);

        storage.getTopHeader(function(error, topHeader) {
            if (topHeader !== 0) {
                passwordController.getPassword(function(password) {
                    if (!password) {
                        showChannelError("Your wallet is locked.  Please unlock your wallet and try again.")
                    } else {
                        storage.getAccounts(password, function(error, accounts) {
                            if (accounts.length === 0) {
                                showChannelError("Please open the wallet and create an account.")
                            } else {
                                var account = accounts[0];
                                amount = Math.floor(parseFloat(amount, 10) * 100000000) - fee;
                                delay = parseInt(delay, 10);
                                var expiration = parseInt(length, 10) + topHeader[1];
                                var bal2 = amount - 1;

                                var acc1 = account.publicKey;
                                var acc2 = pubkey;

                                userController.getBalance(account, topHeader, function (error, balance) {
                                    if (amount > balance) {
                                        showChannelError("You do not have enough VEO.")
                                    } else {
                                        network.send(["new_channel_tx", acc1, pubkey, amount, bal2, delay, fee],
                                            function (error, x) {
                                                make_channel_func2(x, amount, bal2, acc1, acc2, delay, expiration, pubkey, topHeader, timeValue);
                                            }
                                        );
                                    }
                                });
                            }
                        })
                    }
                })
            } else {
                showChannelError("Wallet not synced. Please open the wallet and let it sync.")
            }
        });
    });
}

function make_channel_func2(tx, amount, bal2, acc1, acc2, delay, expiration, pubkey, topHeader, timeValue) {
    var amount0 = tx[5];
    var bal20 = tx[6];
    var fee0 = tx[3];
    var acc10 = tx[1];
    var acc20 = tx[2];
    var cid = tx[8];
    var delay0 = tx[7];
    if ((delay !== delay0) || (amount !== amount0) || (bal2 !== bal20) || (fee !== fee0) ||
        (acc1 !== acc10) || (acc2 !== acc20)) {
        console.log(JSON.stringify([[delay, delay0], [amount, amount0], [bal2, bal20], [fee, fee0], [acc1, acc10], [acc2, acc20]]));
        console.log("server edited the tx. aborting");
    } else {
        var lifespan = expiration - topHeader[1];
        var spk_amount = Math.floor((timeValue * (delay + lifespan) * (amount + bal2) ) / 100000000);
        var spk = ["spk", acc1, acc2, [-6], 0, 0, cid, spk_amount, 0, delay];
        passwordController.getPassword(function(password) {
            if (!password) {
                showChannelError("Your wallet is locked.  Please unlock your wallet and try again.")
            } else {
                storage.getAccounts(password, function (error, accounts) {
                    if (accounts.length === 0) {
                        showChannelError("Please open the wallet and create account");
                    } else {
                        var account = accounts[0];
                        var keys = ec.keyFromPrivate(account.privateKey, "hex");
                        var stx = signTx(keys, tx);
                        var sspk = signTx(keys, spk);

                        try {
                            network.send(["new_channel", stx, sspk, expiration],
                                function(error, x) {
                                    return channels3(x, expiration, pubkey, spk, tx)
                                }
                            );
                        } catch(e) {
                            console.error(e);
                            showChannelError("An error occurred, please try again later");
                        }
                    }
                });
            }
        });
    }
}

function channels3(x, expiration, pubkey, spk, tx_original) {
    var sstx = x[1];
    var s2spk = x[2];
    var tx = sstx[1];
    if (JSON.stringify(tx) !== JSON.stringify(tx_original)) {
        console.log(JSON.stringify(tx));
        console.log(JSON.stringify(tx_original));
        throw("the server illegally manipulated the tx");
    }
    var a = verify_both(sstx);
    if (!(a)) {
        throw("bad signature on tx in channels 3");
    }
    a = verify2(s2spk);
    if (!a) {
        throw("bad signature on spk in channels 3");
    }
    if (JSON.stringify(spk) !== JSON.stringify(s2spk[1])) {
        throw("the server illegally manipulated the spk");
    }
    var cid = tx[8];
    var acc2 = tx[2];

    var spk = s2spk[1];
    var channel = newChannel(spk, s2spk, [], [], expiration, cid);
    channel["serverPubKey"] = pubkey;

    console.log(JSON.stringify(channel));

    saveChannel(channel, function() {
        reloadWeb();

        notificationManager.closePopup();
    });

    // write(acc2, channel);
    // refresh_channels_interfaces(pubkey);
}

function saveChannel(channel, callback) {
    storage.getChannels(function(error, channels) {
        channels.push(channel);
        storage.setChannels(channels, function() {
            callback();
        })
    })
}

function verify(data, sig0, key) {
    var sig = bin2rs(atob(sig0));
    var d2 = serialize(data);
    var h = hash(d2);
    return key.verify(h, sig, "hex");
}

function bin2rs(x) {
    /*
      0x30 b1 0x02 b2 (vr) 0x02 b3 (vs)
      where:

      b1 is a single byte value, equal to the length, in bytes, of the remaining list of bytes (from the first 0x02 to the end of the encoding);
      b2 is a single byte value, equal to the length, in bytes, of (vr);
      b3 is a single byte value, equal to the length, in bytes, of (vs);
      (vr) is the signed big-endian encoding of the value "r", of minimal length;
      (vs) is the signed big-endian encoding of the value "s", of minimal length.
    */
    var h = toHex(x);
    var a2 = x.charCodeAt(3);
    var r = h.slice(8, 8+(a2*2));
    var s = h.slice(12+(a2*2));
    return {"r": r, "s": s};
}

function verify1(tx) {
    return verify(tx[1], tx[2], ec.keyFromPublic(toHex(atob(tx[1][1])), "hex"));
}

function verify2(tx) {
    return verify(tx[1], tx[3], ec.keyFromPublic(toHex(atob(tx[1][2])), "hex"));
}

function verify_both(tx) {
    return (verify1(tx) && verify2(tx));
}

function newChannel(me, them, ssme, ssthem, expiration, cid) {
    return {"me": me, "them": them, "ssme": ssme, "ssthem": ssthem, "cid":cid, "expiration": expiration};
}

function new_ss(code, prove, meta) {
    if (meta == undefined) {
        meta = 0;
    }
    return {"code": code, "prove": prove, "meta": meta};
}

function makeBet(amount, price, type, oid, callback) {
    network.send(["market_data", oid], function (error, l) {
        var price_final = Math.floor(100 * parseFloat(price, 10));
        var type_final;
        var ttv = type;
        if ((ttv == "true") ||
            (ttv == 1) ||
            (ttv == "yes") ||
            (ttv == "si") ||
            (ttv == "cierto") ||
            (ttv == "lon") ||
            (ttv == "真正") ||
            (ttv == "既不是")) {
            type_final = 1;
        } else if ((ttv == "false") ||
            (ttv == 0) ||
            (ttv == 2) ||
            (ttv == "falso") ||
            (ttv == "no") ||
            (ttv == "lon ala") ||
            (ttv == "也不是") ||
            (ttv == "假")) {
            type_final = 2;
        }
        var amount_final = Math.floor(parseFloat(amount, 10) * 100000000);
        var oid_final = oid;
        var expires = l[1];
        var server_pubkey = l[2];
        var period = l[3];

        storage.getTopHeader(function(error, topHeader) {
            if (topHeader !== 0) {
                passwordController.getPassword(function(password) {
                    if (!password) {
                        showBetError("Your wallet is locked.  Please unlock your wallet and try again.")
                    } else {
                        storage.getAccounts(password, function(error, accounts) {
                            var account = accounts[0];
                            var sc = marketContract(type_final, expires, price_final, server_pubkey, period, amount_final, oid_final, topHeader[1]);
                            storage.getChannels(function (error, channels) {
                                var channelFound = false;
                                var channel;
                                for (var i = 0; i < channels.length; i++) {
                                    channel = channels[i];
                                    if (channel.me[1] === account.publicKey && channel.serverPubKey === server_pubkey) {
                                        channelFound = true;
                                        break;
                                    }
                                }

                                if (channelFound) {
                                    var spk = marketTrade(channel, amount_final, price_final, sc, server_pubkey, oid_final);
                                    var keys = ec.keyFromPrivate(account.privateKey, "hex");
                                    var sspk = signTx(keys, spk);

                                    var trie_key = channel.me[6];

                                    try {
                                        merkle.requestProof(topHeader, "channels", trie_key, function(error, val) {
                                            var spk = channel.them[1];
                                            var expiration = channel.expiration;
                                            var height = topHeader[1];
                                            var amount = spk[7];
                                            var betAmount = sumBets(spk[3]);
                                            var mybalance = ((val[4] - amount - betAmount));
                                            var serverbalance = ((val[5] + amount) / 100000000);

                                            if (amount_final > mybalance) {
                                                showBetError("You do not have enough VEO.")
                                            } else {
                                                try {
                                                    return network.send(["trade", account.publicKey, price_final, type_final, amount_final, oid_final, sspk, fee], function (error, x) {
                                                        make_bet3(x, sspk, server_pubkey, oid_final, callback);
                                                    });
                                                } catch (e) {
                                                    console.error(e);
                                                    showBetError("An error occurred.  Please verify you have a channel open and the \"new channel\" transaction has been added to the blockchain.")
                                                }
                                            }
                                        });
                                    } catch(e) {
                                        console.error(e);
                                        callback(row);
                                    }
                                } else {
                                    showBetError("No channel found.  You must first open a channel in order to make bets.")
                                }
                            });
                        });
                    }
                });
            }
        });
    });
}

function sumBets(bets) {
    var x = 0;
    for (var i = 1; i < bets.length; i++) {
        x += bets[i][2];
    }
    return x;
}

function marketContract(direction, expires, maxprice, server_pubkey, period, amount, oid, bet_height) {
    var a;
    var a2 = string_to_array(atob("AAAAAAJ4AA=="));
    var b = string_to_array(atob("AAAAAAN4AA=="));
    var c = string_to_array(atob("AAAAAAR4AgAAACA="));
    var d = string_to_array(atob("AAAAAAV4AA=="));
    var e = string_to_array(atob("AAAAAAZ4AgAAAEE="));
    var f;
    if (direction === 1) {
        a = string_to_array(atob("AAAAJxAAAAAAAXgA"));
        f = string_to_array(atob("AAAAAAd4AAAAAMgAAAAACHgWAAAAAAA6RhQUAAAAAAZ5FV4WNQAAAAAARxQAAAAAATpGFBQWAAAAACiHFRcAAAAAB3kpAAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUAAAAAASHFgAAAAAChwIAAAACAAAWhhYAAAAAAocCAAAAAgAAFoYWAAAAAAV5OgAAAAAAOkYAAAAACHkNRwAAAAAIeQAAAAABMgAAAAAIeEgUFBQUGBUAAAAAAjdQAAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUFwAAAAAJeBUAAAAACngVAAAAAAR5AAAAAAAWMjZQAAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUHgAAAAALeIMUgxYUgxYUgxQAAAAAIIcUAAAAAAGHFhQCAAAAAwAAABaGAAAAAAE6RhQUAAAAAAAAAAAAAwAAAAABeUcUAAAAAAI6RhQUAAAAAAAAAAAAAwAAACcQAAAAAAF5M0cUAAAAAAM6RhQUAAAAAAAAAAAAAwAAACcQAAAAAAR5M0cUAAAAAAA6RhQUAAAAAAEAAAAAAQAAACcQAAAAAAR5M0dISEhIGAAAAAADeV4ZNkYzRxQUAAAAAABIAAAAAAN5MjQXFgAAAAADeQAAAAALeRk2RjNHFBQAAAAAAEgyFgAAAAAKeQAAAAAAFjIAAAAABHk6RhQUAAAAAAl5NAAAACcQNQAAACcQAAAAAAR5MwAAACcQAAAAAAl5MzQAAAAnEDUyRxYzHgAAAAAAOkYUHzJHFB8zSEhHFAAAAAACOkYUFBQAAAAAKIcVFwAAAAAHeSkAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQAAAAABIcWAAAAAAKHAgAAAAIAABaGFgAAAAAChwIAAAACAAAWhhYAAAAABXk6AAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUFBQYFQAAAAACN1AAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQXAAAAAAx4Hh4AAAAAKIcVFwAAAAAHeSkAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQAAAAABIcWAAAAAAKHAgAAAAIAABaGFgAAAAAChwIAAAACAAAWhhYAAAAABXk6AAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUFBQYFQAAAAACN1AAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQXAAAAAA14Fh8ZGTZGFhRHFEgeGTZGFEcWFEgfMwAAAAAGeQAAAAACNTcAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQfOlAXFBQAAAAADHkAAAAADXk6UBcUFFIAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQAAAAAAAAAD0JAAAAPQkAyAAAAAABHFAAAAAADOkYUFBQAAAAAKIcVFwAAAAAHeSkAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQAAAAABIcWAAAAAAKHAgAAAAIAABaGFgAAAAAChwIAAAACAAAWhhYAAAAABXk6AAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUFBQYFQAAAAACN1AAAAAAADpGAAAAAAh5DUcAAAAACHkAAAAAATIAAAAACHhIFBQXXgAAAAAGeTM2AAAAAAA6RgAAAAAIeQ1HAAAAAAh5AAAAAAEyAAAAAAh4SBQUFAAAAAAGeTUAAAAAATIeAAAAAAN5XjMfAAAAJxAAAAAABHkzRxQAAAAABDpGFBSDFIMWFIMWFIMUAAAAACCHFAAAAAABhxYUAgAAAAMAAAAWhgAAAAAAOkYAAAAAA3kAAAAABnkyAAAAB9AyAAAAAAAAAAAnEAAAAAAEeTNHAAAAAAZ5AAAAAAEAAAAnEAAAAAAEeTNIRxRISEhISAs="));
    } else if (direction === 2) {
        a = string_to_array(atob("AAAAAAAAAAAAAXgA"));
        f = string_to_array(atob("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"));
    } else {
        console.log("that is an invalid direction");
        console.log(direction);
        return("invalid direction to bet");
    }

    console.log("market oid is ");
    console.log(oid);
    var g = a.concat(integer_to_array(bet_height, 4)).concat(a2).concat(integer_to_array(expires, 4))
        .concat(b).concat(integer_to_array(maxprice, 4)).concat(c).concat(string_to_array(atob(oid)))
        .concat(d).concat(integer_to_array(period, 4)).concat(e).concat(string_to_array(atob(server_pubkey)))
        .concat(f);
    console.log("compiled contract");
    console.log(JSON.stringify(g));
    var contract =  btoa(array_to_string(g));
    var codekey = ["market", 1, oid, expires, server_pubkey, period, oid]
    return ["bet", contract, amount, codekey, [-7, direction, maxprice]]; //codekey is insttructions on how to re-create the contract, so we can do pattern matching when updating channels.
}

function marketTrade(channel, amount, price, bet, oid) { //oid unused
    var market_spk = channel.me;
    console.log("market trade spk before ");
    console.log(JSON.stringify(market_spk));
    var cid = market_spk[6];
    var time_limit = 10000;//actually constants:time_limit div 10
    var space_limit = 100000;
    var cGran = 10000;
    var a = Math.floor((amount * price) / cGran);
    market_spk[3][0] = bet;
    market_spk[3] = ([-6]).concat(market_spk[3]);//add new bet to front
    market_spk[8] = market_spk[8] + 1; //nonce
    market_spk[5] = market_spk[5] + time_limit;// time_gas/10
    market_spk[4] = Math.max(market_spk[4], space_limit); //space_gas
    market_spk[7] = market_spk[7] - a; //amount
    console.log("market trade spk after ");
    console.log(JSON.stringify(market_spk));
    return market_spk;
}

function make_bet3(sspk2, sspk, server_pubkey, oid_final, callback) {
    var bool = verify_both(sspk2);
    if (!(bool)) {
        throw("make bet3, badly signed sspk2");
    }
    var hspk2 = JSON.stringify(sspk2[1]);
    var hspk = JSON.stringify(sspk[1]);
    if (!(hspk == hspk2)) {
        console.log("error, we calculated the spk differently from the server. you calculated this: ");
        console.log(JSON.stringify(sspk[1]));
        console.log("the server calculated this: ");
        console.log(JSON.stringify(sspk2[1]));
    }

    storage.getChannels(function(error, channels) {
        for (var i = 0; i < channels.length; i++) {
            var channel = channels[i];
            if (channel.serverPubKey === server_pubkey) {
                channel.me = sspk[1];
                channel.them = sspk2;
                var newss = new_ss([0,0,0,0,4], [-6, ["oracles", oid_final]]);
                channel.ssme = ([newss]).concat(channel.ssme);
                channel.ssthem = ([newss]).concat(channel.ssthem);
                break;
            }
        }
        storage.setChannels(channels, function() {
            callback();
        })
    })
}

function initCancel() {
    setTitle("Are you sure you want to cancel?");

    document.getElementById('cancel-container').classList.remove('hidden');

    var index = parseInt(getParameterByName('index'));
    var amount = parseInt(getParameterByName('amount'));
    var price = parseFloat(getParameterByName('price'));
    var side = getParameterByName('side');

    document.getElementById("cancel-bet-side").innerHTML = capitalize(side);
    document.getElementById("cancel-bet-amount").innerHTML = amount;
    document.getElementById("cancel-bet-price").innerHTML = price;

    var cancelButton = document.getElementById("cancel-button");
    cancelButton.onclick = function() {
        network.send(["pubkey"], function(error, pubkey) {
            cancelTrade(index + 2, pubkey);
        });
    }
}

function cancelTrade(n, server_pubkey) {
    storage.getChannels(function(error, channels) {
        var oldCD;
        for (var i = 0; i < channels.length; i++) {
            var channel = channels[i];
            if (channel.serverPubKey === server_pubkey) {
                oldCD = channel;
                break;
            }
        }

        if (oldCD) {
            var spk = oldCD.me;
            var ss = oldCD.ssme[n - 2];

            if (JSON.stringify(ss.code) === JSON.stringify([0,0,0,0,4])) {//this is what an unmatched trade looks like.
                var spk2 = removeBet(n-1, spk);
                spk2[8] += 1000000;
                passwordController.getPassword(function(password) {
                    if (!password) {
                        showCancelError("Your wallet is locked.  Please unlock your wallet and try again.")
                    } else {
                        storage.getAccounts(password, function (error, accounts) {
                            var account = accounts[0];
                            var keys = ec.keyFromPrivate(account.privateKey, "hex");
                            var sspk2 = signTx(keys, spk2);
                            var pubPoint = keys.getPublic("hex");
                            var pubKey = btoa(formatUtility.fromHex(pubPoint));
                            var msg = ["cancel_trade", pubKey, n, sspk2];
                            network.send(msg, function (error, x) {
                                return cancelTradeResponse(x, sspk2, server_pubkey, n - 2);
                            });
                        })
                    }
                });
            } else {
                console.log(ss);
                showCancelError("This trade has already been partially or fully matched. It cannot be canceled now.");
            }
        } else {
            showCancelError("Channel not found");
        }
    });
}

function showCancelError(message) {
    var error = document.getElementById("cancel-error-text");
    error.classList.remove("invisible");
    error.innerHTML = message;
}

function removeBet(n, spk0) {
    var spk = JSON.parse(JSON.stringify(spk0));
    var bets = spk[3];
    var bet = bets[n];
    var bets2 = remove_nth(n, bets);
    var bet_meta = bet[4];
    var a;
    if (bet_meta == 0) {
        a = 0;
    } else {
        var bet_amount = bet[2];
        var cgran = 10000;
        var price = bet_meta[2];
        a = Math.floor((bet_amount * price) / cgran);
    }
    spk[3] = bets2;
    spk[7] = spk[7] + a;
    return spk;
}

function cancelTradeResponse(sspk2, sspk, server_pubkey, n) {
    storage.getChannels(function(error, channels) {
        for (var i = 0; i < channels.length; i++) {
            var channel = channels[i];
            if (channel.serverPubKey === server_pubkey) {
                console.log("cancel trade2, fail to verify this: ");
                console.log(JSON.stringify(sspk2));
                var bool = verify_both(sspk2);
                if (!(bool)) {
                    throw("cancel trade badly signed");
                }
                var spk = sspk[1];
                var spk2 = sspk2[1];
                if (JSON.stringify(spk) != JSON.stringify(spk2)) {
                    console.log("the server didn't calculate the same update as us");
                    console.log(spk);
                    console.log(spk2);
                    throw("cancel trade spk does not match");
                }
                channel.them = sspk2;
                channel.me = spk;
                channel.ssme = remove_nth(n, channel.ssme);
                channel.ssthem = remove_nth(n, channel.ssthem);
            }
        }

        storage.setChannels(channels, function() {
            reloadWeb();

            notificationManager.closePopup();
        })
    })
}

function remove_nth(n, a) {
    var b = a.slice(0, n);
    var c = a.slice(n+1, a.length);
    return b.concat(c);
}

function showMaxBalance(amount) {
    storage.getTopHeader(function(error, topHeader) {
        if (topHeader !== 0) {
            passwordController.getPassword(function(password) {
                if (!password) {
                    showBetError("Your wallet is locked.  Please unlock your wallet and try again.")
                } else {
                    storage.getAccounts(password, function(error, accounts) {
                        var account = accounts[0];
                        storage.getChannels(function (error, channels) {
                            var channelFound = false;
                            var channel;
                            for (var i = 0; i < channels.length; i++) {
                                channel = channels[i];
                                if (channel.me[1] === account.publicKey && channel.serverPubKey === server_pubkey) {
                                    channelFound = true;
                                    break;
                                }
                            }

                            if (channelFound) {
                                var spk = marketTrade(channel, amount_final, price_final, sc, server_pubkey, oid_final);
                                var keys = ec.keyFromPrivate(account.privateKey, "hex");
                                var sspk = signTx(keys, spk);

                                var trie_key = channel.me[6];

                                try {
                                    merkle.requestProof(topHeader, "channels", trie_key, function(error, val) {
                                        var spk = channel.them[1];
                                        var amount = spk[7];
                                        var betAmount = sumBets(spk[3]);
                                        var mybalance = ((val[4] - amount - betAmount));

                                        var userBalance = document.getElementById("bet-user-balance");
                                        userBalance.classList.remove("invisible");
                                        userBalance.innerHTML = "Max bet: " + mybalance + " VEO";

                                        if (amount > userBalance) {
                                            showBetError("Your maximum possible bet is " + mybalance + "VEO");
                                        }
                                    });
                                } catch(e) {
                                    console.error(e);
                                    callback(row);
                                }
                            } else {
                                showBetError("No channel found.  You must first open a channel in order to make bets.")
                            }
                        });
                    });
                }
            });
        }
    });
}
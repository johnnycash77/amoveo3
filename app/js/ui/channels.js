const merkle = require('../lib/merkle-proofs.js');
const storage = require('../lib/storage.js');
const views = require('../lib/views.js');
const fileUtility = require('../lib/file-utility.js');
const passwordController = require('../controller/password-controller.js');

function initChannels(account) {
    storage.getUserChannels(account.publicKey, function(error, channels) {
        if (channels.length > 0) {
            showChannels(channels, account, false);
        } else {
            views.show(views.ids.channels.blank);
        }
    });

    initImportChannel(account);
}

function showChannels(channels, account, shouldReload) {
	views.show(views.ids.accountContainer);
    views.hide(views.ids.firefoxChannelImportContainer);

    if (channels.length > 0) {
        views.hide(views.ids.channels.blank);
    }
    var container = views.find(views.ids.channels.list);
    views.removeAllChildren(views.ids.channels.list);

    storage.getTopHeader(function(error, topHeader) {
        if (topHeader !== 0) {
        	const height = getTopHeader[1];
            for (var i = 0; i < channels.length; i++) {
                var channel = channels[i];
	            if (channel.me[1] === account.publicKey && channel.expiration >= height - 100) {
		            makeChannelRow(topHeader, channel, function (row) {
			            container.appendChild(row);
		            })
	            }
            }

            if (shouldReload) {
                passwordController.setState({
                    selectedAddress: account.publicKey,
                    channels: channels,
                    isLocked: false,
	                topHeader: topHeader
                });
            }
        }
    });
}

function makeChannelRow(topHeader, channel, callback) {
    var row = document.createElement("div");

    var trie_key = channel.me[6];

    try {
        merkle.requestProof(topHeader, "channels", trie_key, function(error, val) {
            var spk = channel.them[1];
            var cid = channel.cid;
            var expiration = channel.expiration;
            var amount = spk[7];
            var betAmount = sumBets(spk[3]) / 100000000;
            var mybalance = ((val[4] - amount - betAmount) / 100000000).toString();
            var serverBalance = ((val[5] + amount) / 100000000).toString();

            var row = document.createElement("div");
            row.className = "channel-row clearfix";
            var idCell = makeChannelCell("Channel Id", cid, "address");
            idCell.style.width = 388;
            var expiresCell = makeChannelCell("Expires", expiration, false);
            var balanceCell = makeChannelCell("Spendable", mybalance, false);
            var betAmountCell = makeChannelCell("Amount Bet", betAmount, false);
            var serverBalanceCell = makeChannelCell("Total", serverBalance, false);
            var clear = document.createElement("div");
            clear.className = "clear";
            var buttonCell = initExportButton(channel);

            row.appendChild(idCell);
            row.appendChild(expiresCell);
            row.appendChild(balanceCell);
            row.appendChild(betAmountCell);
            row.appendChild(serverBalanceCell);
            row.appendChild(clear);
            row.appendChild(buttonCell);

            callback(row);
        });
    } catch(e) {
        console.error(e);
        callback(row);
    }
}

function initExportButton(channel) {
    var container = document.createElement("div");
    var button = document.createElement('button');
    button.className = "btn btn-primary";
    button.innerHTML = "Export"
    button.onclick = function() {
        fileUtility.download(JSON.stringify(channel), "channel_" + new Date() + ".txt", "text/plain");
    }
    container.appendChild(button);
    return container;
}

function sumBets(bets) {
    var x = 0;
    for (var i = 1; i < bets.length; i++) {
        x += bets[i][2];
    }
    return x;
}

function makeChannelCell(labelText, valueText, className) {
    var container = document.createElement("div");
    container.className = "channel-cell";
    var label = document.createElement("label");
    label.className = "channel-cell-label";
    label.innerHTML = labelText;
    var value = document.createElement("p");
    value.className = "channel-cell-value";
    if (className) {
        value.className = value.className + " " + className
    }
    value.innerHTML = valueText;
    container.appendChild(label);
    container.appendChild(value);

    return container;
}

function initImportChannel(account) {
    views.find(views.ids.channels.import);
    var importFile = views.find(views.ids.channels.import);
    var importButton = views.find(views.ids.channels.importButton);
    importButton.onclick = function () {
	    const isFirefox = typeof InstallTrigger !== 'undefined';
	    if (isFirefox) {
		    showFirefoxImport(account);
	    } else {
		    importFile.click();
	    }
    };
    importFile.onchange = function () {
        var file = (importFile.files)[0];
        var reader = new FileReader();
        reader.onload = function (e) {
	        importChannelText(account, reader.result);
        };

        if (file.type !== "text/plain") {
            console.log("Invalid channel data");
            showImportError("Invalid file format");
        } else {
            reader.readAsText(file);
        }
    }
}

function importChannelText(account, channelText) {
	try {
		var channel = JSON.parse(channelText);
		var serverPubKey = Object.keys(channel)[0];
		if (serverPubKey !== "me") {
			channel = channel[serverPubKey];
			channel["serverPubKey"] = serverPubKey;
		}

		storage.getChannels(function(error, channels) {
			if (channels.length > 0) {
				var isDuplicate = false;
				for (var i = 0; i < channels.length; i++) {
				    var thisChannel = channels[i];
					if (thisChannel.me[1] === account.publicKey && serverPubKey === thisChannel.serverPubKey) {
						isDuplicate = true;
						break;
					}
				}
				if (isDuplicate) {
					channels[i] = channel;
					storage.setChannels(channels, function () {
						console.log("Channel imported");

						showChannels(channels, account, true);
					});
					console.log("Duplicate channel - Overwriting");
					// showImportError("This channel has already been imported");
				} else {
					channels.unshift(channel);
					storage.setChannels(channels, function () {
						console.log("Channel imported");

						showChannels(channels, account, true);
					});
				}
			} else {
				storage.setChannels([channel], function () {
					console.log("Channel imported");

					showChannels([channel], account, true);
				});
			}
		});
	} catch(e) {
		const isFirefox = typeof InstallTrigger !== 'undefined';
		if (isFirefox) {
			showFirefoxImportError("Invalid file format")
		} else {
			showImportError("Invalid file format")
		}
	}
}

function showFirefoxImport(account) {
	views.hide(views.ids.accountContainer);
	views.show(views.ids.firefoxChannelImportContainer);

	var button = views.find(views.ids.firefoxChannelImport.button);

	button.onclick = function() {
		var channelText = views.find(views.ids.firefoxChannelImport.import).value;

		if (channelText.length === 0) {
			showFirefoxImportError("Invalid format");
		} else {
			importChannelText(account, channelText);
		}
	}
}

function showFirefoxImportError(message) {
	var error = views.find(views.ids.firefoxChannelImport.error);
	error.innerHTML = message;
	views.show(views.ids.firefoxChannelImport.error);
}

function showImportError(message) {
    var error = views.find(views.ids.channels.importError);
    error.innerHTML = message;
    error.classList.remove("invisible");
}

function exportChannel(channel) {
    download(channel, "channel_" + new Date() + ".txt", "text/plain");
}

module.exports = initChannels;
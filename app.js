//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require('express-session');
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const uuid = require('uuid');
const AWS = require('aws-sdk');
AWS.config.update({
    region: "eu-west-2",
});
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
	extended: true,
}));
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: {
		maxAge: 60 * 60 * 1000,
	},
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new Strategy(function(username, password, cb) {
    const params = {
        TableName: process.env.CONTACT_TABLE_NAME,
        FilterExpression: "#address = :address AND #password = :password",
        ExpressionAttributeNames: {
            "#address": "address",
            "#password": "password",
        },
        ExpressionAttributeValues: {
            ":address": username,
            ":password": password,
        },
    };

    //get contact
    dynamoDb.scan(params, (error, result) => {
    	if (error) {
    		console.error(error);
    	}

    	//is there an object where username & password match?
    	if (result.Count > 0) {
    		const contact = result.Items[0];

    		if (contactValid(contact)) {
    			return cb(null, contact);
    		}
    	}

		return cb(null, false);
    });
}));
passport.serializeUser(function(contact, cb) {
	cb(null, contact.warehouseId + "£" + contact.address);
});
passport.deserializeUser(function(id, cb) {
	const idParts = id.split("£");

	const params = {
        TableName: process.env.CONTACT_TABLE_NAME,
        Key: {
            warehouseId: idParts[0],
            address: idParts[1],
        },
    };

    dynamoDb.get(params, (error, result) => {
    	if (error) {
    		console.error(error);
    	}

    	if (contactValid(result.Item)) {
    		return cb(null, result.Item);
    	}
    });
});

//object validation methods
function objValid(obj) {
	return obj !== null && typeof obj !== 'undefined' && obj.length !== 0;
}

function contactValid(contact) {
	if (contact !== null && typeof contact !== 'undefined') {
        return contact.warehouseId !== null && typeof contact.warehouseId !== 'undefined' && contact.warehouseId.length !== 0
            && contact.address !== null && typeof contact.address !== 'undefined' && contact.address.length !== 0;
    }

    return false;
}

function lastEvaluatedKeyValid(lastEvaluatedKey) {
    return lastEvaluatedKey !== null && typeof lastEvaluatedKey !== 'undefined' && lastEvaluatedKey.length !== 0;
}

function isGroup(name, callback) {
	const groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#name = :name',
		ExpressionAttributeNames: {
		    "#name": "name",
		},
		ExpressionAttributeValues: {
		    ":name": name,
		},
	};

	let emptyArray = [];
	scanGroups(groupParams, emptyArray, function(error, groups) {
		if (groups.length > 0) {
			return callback(true);
		} else {
			return callback(false);
		}
	});
}

//utils
function generateTimestamp() {
    let d = new Date();
    // d.setTime(d.getTime() + (60 * 60 * 1000));
    return d.toISOString().replace("T", " ").replace("Z", "");
}

//scan methods
function scanGroups(params, groups, callback) {
    dynamoDb.scan(params, (error, result) => {
    	if (error) {
    		console.error(error);

    		return callback(error, null);
    	} else if (lastEvaluatedKeyValid(result.LastEvaluatedKey)) {
            //if LastEvaluatedKey is present & valid, we need to paginate
            //assign objects
            groups.push(...result.Items);

            //modify params
            params["ExclusiveStartKey"] = result.LastEvaluatedKey;

            //recursive call
            scanGroups(params, groups, callback);
        } else {
            //assign objects to class variable
            groups.push(...result.Items);

            //no more pagination required
            return callback(null, groups);
        }
    });
}

function scanContacts(params, contacts, callback) {
    dynamoDb.scan(params, (error, result) => {
        if (error) {
            console.error(error);

            return callback(error, null);
        } else if (lastEvaluatedKeyValid(result.LastEvaluatedKey)) {
            //if LastEvaluatedKey is present & valid, we need to paginate
            //assign objects
            contacts.push(...result.Items);

            //modify params
            params["ExclusiveStartKey"] = result.LastEvaluatedKey;

            //recursive call
            scanContacts(params, contacts, callback);
        } else {
            //assign objects to class variable
            contacts.push(...result.Items);

            //no more pagination required
            return callback(null, contacts);
        }
    });
}

function scanMessages(params, messages, callback) {
    dynamoDb.scan(params, (error, result) => {
        if (error) {
            console.error(error);

            return callback(error, null);
        } else if (lastEvaluatedKeyValid(result.LastEvaluatedKey)) {
            //if LastEvaluatedKey is present & valid, we need to paginate
            //assign objects
            messages.push(...result.Items);

            //modify params
            params["ExclusiveStartKey"] = result.LastEvaluatedKey;

            //recursive call
            scanMessages(params, messages, callback);
        } else {
            //assign objects to class variable
            messages.push(...result.Items);

            //no more pagination required
            return callback(null, messages);
        }
    });
}

function scanMessageReceipts(params, messageReceipts, callback) {
    dynamoDb.scan(params, (error, result) => {
    	if (error) {
    		console.error(error);

    		return callback(error, null);
    	} else if (lastEvaluatedKeyValid(result.LastEvaluatedKey)) {
            //if LastEvaluatedKey is present & valid, we need to paginate
            //assign objects
            messageReceipts.push(...result.Items);

            //modify params
            params["ExclusiveStartKey"] = result.LastEvaluatedKey;

            //recursive call
            scanMessageReceipts(params, messageReceipts, callback);
        } else {
            //assign objects to class variable
            messageReceipts.push(...result.Items);

            //no more pagination required
            return callback(null, messageReceipts);
        }
    });
}

function scanLicences(params, licences, callback) {
    dynamoDb.scan(params, (error, result) => {
        if (error) {
            console.error(error);

            return callback(error, null);
        } else if (lastEvaluatedKeyValid(result.LastEvaluatedKey)) {
            //if LastEvaluatedKey is present & valid, we need to paginate
            //assign objects
            licences.push(...result.Items);

            //modify params
            params["ExclusiveStartKey"] = result.LastEvaluatedKey;

            //recursive call
            scanLicences(params, licences, callback);
        } else {
            //assign objects to class variable
            licences.push(...result.Items);

            //no more pagination required
            return callback(null, licences);
        }
    });
}

function scanDevices(params, devices, callback) {
    dynamoDb.scan(params, (error, result) => {
        if (error) {
            console.error(error);

            return callback(error, null);
        } else if (lastEvaluatedKeyValid(result.LastEvaluatedKey)) {
            //if LastEvaluatedKey is present & valid, we need to paginate
            //assign objects
            devices.push(...result.Items);

            //modify params
            params["ExclusiveStartKey"] = result.LastEvaluatedKey;

            //recursive call
            scanDevices(params, devices, callback);
        } else {
            //assign objects to class variable
            devices.push(...result.Items);

            //no more pagination required
            return callback(null, devices);
        }
    });
}

//sorting/filtering methods
function sortGroupsAndContacts(groups, contacts, currentUser) {
	const map = new Map();

	for (let x = 0; x < groups.length; x++) {
		map.set({
			partialId: groups[x].name,
			firstName: '',
			lastName: '',
			isGroup: true,
		}, filterContacts(contacts, groups[x].name, currentUser));
	}

	return map;
}

function filterContacts(contacts, name, currentUser) {
	let filteredContacts = [];

	for (let x = 0; x < contacts.length; x++) {
		if (contacts[x].group === name && contacts[x].address !== currentUser) {
			filteredContacts.push({
				partialId: contacts[x].address,
				firstName: contacts[x].firstName,
				lastName: contacts[x].lastName,
				isGroup: false,
				groupName: contacts[x].group,
			});
		}
	}

	return filteredContacts;
}

function filterGroupContact(groups, contacts, selected) {
	let selectedGroupContact = {
		partialId: selected,
	};

	for (let x = 0; x < groups.length; x++) {
		if (groups[x].name === selected) {
			selectedGroupContact["isGroup"] = true;
			selectedGroupContact["groupName"] = groups[x].name;
			return selectedGroupContact;
		}
	}

	for (let y = 0; y < contacts.length; y++) {
		if (contacts[y].address === selected) {
			selectedGroupContact["firstName"] = contacts[y].firstName;
			selectedGroupContact["lastName"] = contacts[y].lastName;
			selectedGroupContact["isGroup"] = false;
			selectedGroupContact["groupName"] = contacts[y].group;
			return selectedGroupContact;
		}
	}

	return selectedGroupContact;
}

function sortMessages(messages) {
	messages.sort((a, b) => {
		const comp1 = a.timestamp;
		const comp2 = b.timestamp;

		if (comp1 < comp2) {
			return 1;
		}

		if (comp1 > comp2) {
			return -1;
		}

		return 0;
	});

	return messages;
}

//db insert methods
function insertMessage(item, callback) {
	//create params
	const params = {
	    TableName: process.env.MESSAGE_TABLE_NAME,
	    Item: {
	        id: item.id,
	        timestamp: item.timestamp,
	        message: item.message,
	        from: item.from,
	        isGroupMessage: item.isGroupMessage,
	        groupMessageId: item.groupMessageId,
	        isIndividualMessage: item.isIndividualMessage,
	        firstName: item.firstName,
	        lastName: item.lastName,
	    },
	};

	dynamoDb.put(params, (error) => {
	    //handle potential errors
	    if (error) {
	        console.error(error);
	    }

	    if (!item.isGroupMessage) {
	    	//create params to insert message receipt row
	    	const messageReceiptParams = {
	    	    TableName: process.env.MESSAGE_RECEIPT_TABLE_NAME,
	    	    Item: {
	    	        id: uuid.v4(),
	    	        warehouseId: item.id.split("£")[0],
	    	        groupName: '',
	    	        deliveredTimestamp: generateTimestamp(),
	    	        from: item.from,
	    	        to: item.id.split("£")[1],
	    	        status: 'Delivered',
	    	        readTimestamp: '',
	    	        groupMessageId: item.groupMessageId,
	    	    },
	    	};

	    	dynamoDb.put(messageReceiptParams, (error) => {
	    	    //handle potential errors
	    	    if (error) {
	    	        console.error(error);
	    	    }

	    	    return callback(error);
	    	});
	    } else {
	    	return callback(error);
	    }
	});
}

function insertMessages(item, contacts, callback) {
	let x = contacts.length;
	if (x === 0) {
		return callback();
	} else {
		//take 1 away from x because length is always 1 more than index
		--x;

		const contact = contacts[x];

		//create params
		const params = {
		    TableName: process.env.MESSAGE_TABLE_NAME,
		    Item: {
		        id: contact.warehouseId + "£" + contact.address,
		        timestamp: item.timestamp,
		        message: item.message,
		        from: item.from,
		        isGroupMessage: false,
		        groupMessageId: item.groupMessageId,
		        isIndividualMessage: false,
		        firstName: item.firstName,
		        lastName: item.lastName,
		    },
		};

		dynamoDb.put(params, (error) => {
		    //handle potential errors
		    if (error) {
		        console.error(error);
		    }

		    //create params to insert message receipt row
		    const messageReceiptParams = {
		        TableName: process.env.MESSAGE_RECEIPT_TABLE_NAME,
		        Item: {
		            id: uuid.v4(),
		            warehouseId: contact.warehouseId,
		            groupName: item.groupName,
		            deliveredTimestamp: generateTimestamp(),
		            from: item.from,
		            to: contact.address,
		            status: 'Delivered',
		            readTimestamp: '',
		            groupMessageId: item.groupMessageId,
		        },
		    };

		    dynamoDb.put(messageReceiptParams, (error) => {
		        //handle potential errors
		        if (error) {
		            console.error(error);
		        }

		        //regardless of status, delete element from current array
		        contacts.splice(x, 1);

		        //run this method again (recursive)
		        insertMessages(item, contacts, callback);
		    });
		});
	}
}

function insertGroup(item, callback) {
	//create params
	const params = {
	    TableName: process.env.GROUP_TABLE_NAME,
	    Item: {
	        warehouseId: item.warehouseId,
	        name: item.name,
	        deferredMessage: item.deferredMessage,
	    },
	};

	dynamoDb.put(params, (error) => {
	    //handle potential errors
	    if (error) {
	        console.error(error);
	    }

	    return callback(error);
	});
}

function insertColleague(item, callback) {
	//create params
	const params = {
	    TableName: process.env.CONTACT_TABLE_NAME,
	    Item: {
	        warehouseId: item.warehouseId,
	        address: item.address,
	        group: item.group,
	        password: item.password,
	        role: item.role,
	        firstName: item.firstName,
	        lastName: item.lastName,
	    },
	};

	dynamoDb.put(params, (error) => {
	    //handle potential errors
	    if (error) {
	        console.error(error);
	    }

	    return callback(error);
	});
}

function insertMessageArchives(messages, callback) {
	let x = messages.length;
	if (x === 0) {
		return callback();
	} else {
		//take 1 away from x because length is always 1 more than index
		--x;

		const message = messages[x];

		//create params
		const params = {
		    TableName: process.env.MESSAGE_ARCHIVE_TABLE_NAME,
		    Item: {
		        id: message.id,
		        timestamp: message.timestamp,
		        message: message.message,
		        from: message.from,
		        isGroupMessage: message.isGroupMessage,
		        groupMessageId: message.groupMessageId,
		        isIndividualMessage: message.isIndividualMessage,
		        firstName: message.firstName,
		        lastName: message.lastName,
		    },
		};

		dynamoDb.put(params, (error) => {
		    //handle potential errors
		    if (error) {
		        console.error(error);
		    }

		    //regardless of status, delete element from current array
		    messages.splice(x, 1);

		    //run this method again (recursive)
		    insertMessageArchives(messages, callback);
		});
	}
}

//db delete methods
function deleteContact(item, callback) {
	const params = {
	    TableName: process.env.CONTACT_TABLE_NAME,
	    Key: {
	        warehouseId: item.warehouseId,
	        address: item.address,
	    },
	};

	//delete item
	dynamoDb.delete(params, (error, result) => {
	    //handle potential errors
	    if (error) {
	        console.error(error);
	    }

	    return callback(error);
	});
}

function deleteGroup(item, callback) {
	const params = {
	    TableName: process.env.GROUP_TABLE_NAME,
	    Key: {
	        warehouseId: item.warehouseId,
	        name: item.name,
	    },
	};

	//delete item
	dynamoDb.delete(params, (error, result) => {
	    //handle potential errors
	    if (error) {
	        console.error(error);
	    }

	    return callback(error);
	});
}

function deleteMessages(messages, callback) {
	let x = messages.length;
	if (x === 0) {
		return callback();
	} else {
		//take 1 away from x because length is always 1 more than index
		--x;

		const message = messages[x];

		//create params
		const params = {
		    TableName: process.env.MESSAGE_TABLE_NAME,
		    Key: {
		        id: message.id,
		        timestamp: message.timestamp,
		    },
		};

		dynamoDb.delete(params, (error, result) => {
		    //handle potential errors
		    if (error) {
		        console.error(error);
		    }

		    //regardless of status, delete element from current array
		    messages.splice(x, 1);
		    
		    //run this method again (recursive)
		    deleteMessages(messages, callback);
		});
	}
}

function deleteDevice(deviceId, callback) {
	const params = {
	    TableName: process.env.DEVICE_TABLE_NAME,
	    Key: {
	        deviceId: deviceId,
	    },
	};

	//delete item
	dynamoDb.delete(params, (error, result) => {
	    //handle potential errors
	    if (error) {
	        console.error(error);
	    }

	    return callback(error);
	});
}

//db update methods
function setColleagueGroup(colleagues, newGroup, callback) {
	let x = colleagues.length;
	if (x === 0) {
		return callback();
	} else {
		//take 1 away from x because length is always 1 more than index
		--x;

		const colleague = colleagues[x];

		const updateParams = {
            TableName: process.env.CONTACT_TABLE_NAME,
            Key: {
                warehouseId: colleague.warehouseId,
                address: colleague.address,
            },
            UpdateExpression: 'SET #group = :group',
            ExpressionAttributeNames: {
                "#group": "group",
            },
            ExpressionAttributeValues: {
                ":group": newGroup,
            },
        };

        dynamoDb.update(updateParams, (error) => {
            //handle potential errors
            if (error) {
                console.error(error);
            }

            //regardless of status, delete element from current array
            colleagues.splice(x, 1);

            //run this method again (recursive)
            setColleagueGroup(colleagues, newGroup, callback);
        });
	}
}

function setMessageReceipt(messageReceipts, callback) {
	let x = messageReceipts.length;
	if (x === 0) {
		return callback();
	} else {
		//take 1 away from x because length is always 1 more than index
		--x;

		const messageReceipt = messageReceipts[x];

		const updateParams = {
            TableName: process.env.MESSAGE_RECEIPT_TABLE_NAME,
            Key: {
                id: messageReceipt.id,
            },
            UpdateExpression: 'SET #status = :status, #readTimestamp = :readTimestamp',
            ExpressionAttributeNames: {
                "#status": "status",
                "#readTimestamp": "readTimestamp",
            },
            ExpressionAttributeValues: {
                ":status": 'Read',
                ":readTimestamp": generateTimestamp(),
            },
        };

        dynamoDb.update(updateParams, (error) => {
            //handle potential errors
            if (error) {
                console.error(error);
            }

            //regardless of status, delete element from current array
            messageReceipts.splice(x, 1);

            //run this method again (recursive)
            setMessageReceipt(messageReceipts, callback);
        });
	}
}

function setGroupDeferredMessage(warehouseId, name, deferredMessage, callback) {
	const updateParams = {
        TableName: process.env.GROUP_TABLE_NAME,
        Key: {
            warehouseId: warehouseId,
            name: name,
        },
        UpdateExpression: 'SET #deferredMessage = :deferredMessage',
        ExpressionAttributeNames: {
            "#deferredMessage": "deferredMessage",
        },
        ExpressionAttributeValues: {
            ":deferredMessage": deferredMessage,
        },
    };

    dynamoDb.update(updateParams, (error) => {
        //handle potential errors
        if (error) {
            console.error(error);
        }

        return callback();
    });
}

//webpage loading methods
function loadViewPage(req, res) {
	let groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		},
	};

	let emptyGroupsArray = [];
	scanGroups(groupParams, emptyGroupsArray, function(error, groups) {
		if (error !== null) {
		    //TODO - error scenario
		} else if (groups === null || groups.length < 1) {
		    //TODO - error scenario
		} else {
		    //groups OK, now get contacts
		    let contactParams = {
		        TableName: process.env.CONTACT_TABLE_NAME,
		        FilterExpression: '#warehouseId = :warehouseId',
		        ExpressionAttributeNames: {
		            "#warehouseId": "warehouseId",
		        },
		        ExpressionAttributeValues: {
		            ":warehouseId": req.user.warehouseId,
		        },
		    };

		    let emptyContactsArray = [];
		    scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
		        if (error !== null) {
		            //TODO - error scenario
		        } else if (contacts === null || contacts.length < 1) {
		            //TODO - error scenario
		        } else {
		            //contacts OK, now get messages
		            //default view all params
		        	let filterExpression = 'begins_with(#id, :warehouseId)';
		        	let expressionAttributeNames = {
	            	    "#id": "id",
	            	};
		        	let expressionAttributeValues = {
	            	    ":warehouseId": req.user.warehouseId,
	            	};

	            	//do we have a query string param?
	            	if (objValid(req.query.selected)) {
	            		filterExpression += ' AND #id = :id OR #id2 = :id2 AND #from = :from';
						expressionAttributeNames['#id'] = "id";
						expressionAttributeNames['#id2'] = "id";
						expressionAttributeNames['#from'] = "from";
						expressionAttributeValues[':id'] = req.user.warehouseId + "£" + req.query.selected;
						expressionAttributeValues[':id2'] = req.user.warehouseId + "£" + req.user.address;
						expressionAttributeValues[':from'] = req.query.selected;
	            	}

		            let messageParams = {
		            	TableName: process.env.MESSAGE_TABLE_NAME,
		            	FilterExpression: filterExpression,
		            	ExpressionAttributeNames: expressionAttributeNames,
		            	ExpressionAttributeValues: expressionAttributeValues,
		            };

		            let emptyMessagesArray = [];
		            scanMessages(messageParams, emptyMessagesArray, function(error, messages) {
		            	//mark all delivered messages as read & set timestamp
		            	//get relevant rows
		            	let params = {
		            		TableName: process.env.MESSAGE_RECEIPT_TABLE_NAME,
		            		FilterExpression: '#warehouseId = :warehouseId AND #to = :to AND #status <> :status',
		            		ExpressionAttributeNames: {
		            		    "#warehouseId": "warehouseId",
		            		    "#to": "to",
		            		    "#status": "status",
		            		},
		            		ExpressionAttributeValues: {
		            		    ":warehouseId": req.user.warehouseId,
		            		    ":to": req.user.address,
		            		    ":status": 'Read',
		            		},
		            	};

		            	let emptyMessageReceiptsArray = [];
		            	scanMessageReceipts(params, emptyMessageReceiptsArray, function(error, messageReceipts) {
		            		//should have a list of message receipts for this user
		            		//pass the array to the update method to mark all as read
		            		setMessageReceipt(messageReceipts, function() {
        						res.render("view", {
        			            	user: req.user,
        			            	messages: sortMessages(messages),
        			            	groupsContacts: sortGroupsAndContacts(groups, contacts, req.user.address),
        			            	selectedGroupContact: filterGroupContact(groups, contacts, req.query.selected),
        			            });
		            		});
		            	});
		            });
		        }
		    });
		}
	});
}

function loadDeleteColleaguePage(req, res) {
	let groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId AND #name <> :name',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		    "#name": "name",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		    ":name": "Administrator",
		},
	};

	let emptyGroupsArray = [];
	scanGroups(groupParams, emptyGroupsArray, function(error, groups) {
		if (error !== null) {
		    //TODO - error scenario
		} else if (groups === null || groups.length < 1) {
		    //TODO - error scenario
		} else {
		    //groups OK, now get contacts
			let filterExpression = '#warehouseId = :warehouseId AND #address <> :address';
			let expressionAttributeNames = {
	            "#warehouseId": "warehouseId",
	            "#address": "address",
	        };
	        let expressionAttributeValues = {
	        	":warehouseId": req.user.warehouseId,
	        	":address": req.user.address,
	        };

			if (objValid(req.query.group)) {
				filterExpression += ' AND #group = :group';
				expressionAttributeNames['#group'] = "group";
				expressionAttributeValues[':group'] = req.query.group;
			}

		    let contactParams = {
		        TableName: process.env.CONTACT_TABLE_NAME,
		        FilterExpression: filterExpression,
		        ExpressionAttributeNames: expressionAttributeNames,
		        ExpressionAttributeValues: expressionAttributeValues,
		    };

		    let emptyContactsArray = [];
		    scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
            	//contacts OK, now show screen
    			res.render("delete-colleague", {
            		user: req.user,
                	groups: groups,
                	colleagues: contacts,
                	filteredGroup: req.query.group,
            	});
		    });
		}
	});
}

function loadDeleteGroupPage(req, res) {
	let groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId AND #nameOne <> :nameOne AND #nameTwo <> :nameTwo',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		    "#nameOne": "name",
		    "#nameTwo": "name",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		    ":nameOne": 'Administrator',
		    ":nameTwo": 'Inactive',
		},
	};

	let emptyGroupsArray = [];
	scanGroups(groupParams, emptyGroupsArray, function(error, groups) {
		if (error !== null) {
		    //TODO - error scenario
		} else if (groups === null || groups.length < 1) {
		    //TODO - error scenario
		} else {
		    //groups OK, now show screen
			res.render("delete-group", {
        		user: req.user,
            	groups: groups,
        	});
		}
	});
}

function loadEditGroupPage(req, res) {
	let groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId AND #nameOne <> :nameOne',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		    "#nameOne": "name",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		    ":nameOne": 'Administrator',
		},
	};

	let emptyGroupsArray = [];
	scanGroups(groupParams, emptyGroupsArray, function(error, groups) {
		if (error !== null) {
		    //TODO - error scenario
		} else if (groups === null || groups.length < 1) {
		    //TODO - error scenario
		} else {
		    //groups OK, now show screen
			res.render("edit-group", {
        		user: req.user,
            	groups: groups,
            	editableGroup: req.query.editableGroup,
        	});
		}
	});
}

function loadEditColleaguePage(req, res) {
	let groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId AND #name <> :name',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		    "#name": "name",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		    ":name": 'Administrator',
		},
	};

	let emptyGroupsArray = [];
	scanGroups(groupParams, emptyGroupsArray, function(error, groups) {
		if (error !== null) {
		    //TODO - error scenario
		} else if (groups === null || groups.length < 1) {
		    //TODO - error scenario
		} else {
		    //groups OK, now get contacts
			let filterExpression = '#warehouseId = :warehouseId';
			let expressionAttributeNames = {
	            "#warehouseId": "warehouseId",
	        };
	        let expressionAttributeValues = {
	        	":warehouseId": req.user.warehouseId,
	        };

			if (objValid(req.query.group)) {
				filterExpression += ' AND #group = :group';
				expressionAttributeNames['#group'] = "group";
				expressionAttributeValues[':group'] = req.query.group;
			}

		    let contactParams = {
		        TableName: process.env.CONTACT_TABLE_NAME,
		        FilterExpression: filterExpression,
		        ExpressionAttributeNames: expressionAttributeNames,
		        ExpressionAttributeValues: expressionAttributeValues,
		    };

		    let emptyContactsArray = [];
		    scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
            	//contacts OK, now show screen
    			res.render("edit-colleague", {
            		user: req.user,
                	groups: groups,
                	colleagues: contacts,
                	filteredGroup: req.query.group,
                	editableColleague: req.query.editableColleague,
            	});
		    });
		}
	});
}

function loadGroupMessageInfoPage(req, res) {
	//params to get all contacts in group that aren't the current user
	let contactParams = {
	    TableName: process.env.CONTACT_TABLE_NAME,
	    FilterExpression: '#warehouseId = :warehouseId',
	    ExpressionAttributeNames: {
	        "#warehouseId": "warehouseId",
	    },
	    ExpressionAttributeValues: {
	        ":warehouseId": req.user.warehouseId,
	    },
	};

	let emptyContactsArray = [];
	scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
		let params = {
			TableName: process.env.MESSAGE_RECEIPT_TABLE_NAME,
			FilterExpression: '#warehouseId = :warehouseId AND #groupMessageId = :groupMessageId',
			ExpressionAttributeNames: {
			    "#warehouseId": "warehouseId",
			    "#groupMessageId": "groupMessageId",
			},
			ExpressionAttributeValues: {
			    ":warehouseId": req.user.warehouseId,
			    ":groupMessageId": req.query.groupMessageId,
			},
		};

		let emptyMessageReceiptsArray = [];
		scanMessageReceipts(params, emptyMessageReceiptsArray, function(error, messageReceipts) {
			res.render("group-message-info", {
            	messageReceipts: messageReceipts,
            	contacts: contacts,
        	});
		});
	});
}

function loadAddColleaguePage(req, res, status, statusColour) {
	let groupParams = {
		TableName: process.env.GROUP_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId AND #name <> :name',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		    "#name": "name",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		    ":name": 'Administrator',
		},
	};

	let emptyGroupsArray = [];
	scanGroups(groupParams, emptyGroupsArray, function(error, groups) {
		res.render("add-colleague", {
        	user: req.user,
        	statusColour: statusColour,
        	status: status,
        	groups: groups,
        });
	});
}

function loadAddGroupPage(req, res, status, statusColour) {
	res.render("add-group", {
    	user: req.user,
    	statusColour: statusColour,
    	status: status,
    });
}

function loadViewLicencesPage(req, res) {
	let licenceParams = {
		TableName: process.env.LICENCE_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		},
	};

	let emptyLicencesArray = [];
	scanLicences(licenceParams, emptyLicencesArray, function(error, licences) {
		if (error !== null) {
		    //TODO - error scenario
		} else {
        	//contacts OK, now show screen
			res.render("view-licences", {
        		user: req.user,
	        	licences: licences,
        	});
		}
	});
}

function loadViewDevicesPage(req, res) {
	let licenceParams = {
		TableName: process.env.LICENCE_TABLE_NAME,
		FilterExpression: '#warehouseId = :warehouseId',
		ExpressionAttributeNames: {
		    "#warehouseId": "warehouseId",
		},
		ExpressionAttributeValues: {
		    ":warehouseId": req.user.warehouseId,
		},
	};

	let emptyLicencesArray = [];
	scanLicences(licenceParams, emptyLicencesArray, function(error, licences) {
		if (error !== null) {
		    //TODO - error scenario
		} else {
		    //licences OK, now get devices
			let filterExpression = '#warehouseId = :warehouseId';
			let expressionAttributeNames = {
	            "#warehouseId": "warehouseId",
	        };
	        let expressionAttributeValues = {
	        	":warehouseId": req.user.warehouseId,
	        };

			if (objValid(req.query.licence)) {
				filterExpression += ' AND #licenceId = :licenceId';
				expressionAttributeNames['#licenceId'] = "licenceId";
				expressionAttributeValues[':licenceId'] = req.query.licence;
			}

			let deviceParams = {
				TableName: process.env.DEVICE_TABLE_NAME,
				FilterExpression: filterExpression,
				ExpressionAttributeNames: expressionAttributeNames,
				ExpressionAttributeValues: expressionAttributeValues,
			};

			let emptyDevicesArray = [];
			scanDevices(deviceParams, emptyDevicesArray, function(error, devices) {
				if (error !== null) {
				    //TODO - error scenario
				} else {
		        	//contacts OK, now show screen
					res.render("view-devices", {
		        		user: req.user,
			        	devices: devices,
			        	licences: licences,
			        	filteredLicence: req.query.licence,
		        	});
				}
			});
		}
	});
}

//GET routes
app.get("/", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});

app.get("/index.html", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});

app.get("/login.html", function(req, res) {
	res.sendFile(__dirname + "/login.html");
});

app.get("/logout.html", function(req, res) {
	req.logout();
	res.redirect("/index.html");
});

app.get("/view.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		loadViewPage(req, res);
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/add-group.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			res.render("add-group", {
	        	user: req.user,
	        	statusColour: "",
	        	status: "",
	        });
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/add-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadAddColleaguePage(req, res, "", "");
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/delete-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadDeleteColleaguePage(req, res);
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/delete-group.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadDeleteGroupPage(req, res);
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/edit-group.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadEditGroupPage(req, res);
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/edit-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadEditColleaguePage(req, res);
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view.html/groupMessageInfo", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		loadGroupMessageInfoPage(req, res);
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-licences.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadViewLicencesPage(req, res);
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-devices.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			loadViewDevicesPage(req, res);
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

//POST routes
app.post("/login.html", function(req, res) {
	passport.authenticate("local")(req, res, function() {
		res.redirect(req.headers.referer);
	});
});

app.post("/logout.html", function(req, res) {
	req.logout();
	res.redirect("/index.html");
});

app.post("/view.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		const to = req.body.selectedGroupOrContact;
		const message = req.body.messageToSend;
		
		if (!objValid(to)) {
			//TODO - notify user?
			loadViewPage(req, res);
			return;
		}

		if (!objValid(message)) {
			//TODO - notify user?
			loadViewPage(req, res);
			return;
		}

		//group or individual contact?
		isGroup(to, function(isGroup) {
			//always send 1 message to the group/contact
			const item = {
				id: req.user.warehouseId + "£" + to,
				timestamp: generateTimestamp(),
				message: message,
				from: req.user.address,
				isGroupMessage: isGroup,
				groupMessageId: uuid.v4(),
				isIndividualMessage: !isGroup,
				firstName: req.user.firstName,
				lastName: req.user.lastName,
			};

			insertMessage(item, function(error) {
				//do we need to send individual messages to contacts within the group as well?
				if (isGroup) {
					//params to get all contacts in group that aren't the current user
					let contactParams = {
					    TableName: process.env.CONTACT_TABLE_NAME,
					    FilterExpression: '#warehouseId = :warehouseId AND #group = :group AND #address <> :address',
					    ExpressionAttributeNames: {
					        "#warehouseId": "warehouseId",
					        "#group": "group",
					        "#address": "address",
					    },
					    ExpressionAttributeValues: {
					        ":warehouseId": req.user.warehouseId,
					        ":group": to,
					        ":address": req.user.address,
					    },
					};

					let emptyContactsArray = [];
					scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
				        if (error !== null) {
				            //TODO - error scenario
				        } else {
				            const partialItem = {
				            	timestamp: item.timestamp,
				            	message: message,
				            	from: req.user.address,
				            	groupName: to,
				            	groupMessageId: item.groupMessageId,
				            	firstName: req.user.firstName,
				            	lastName: req.user.lastName,
				            };

				            //send message to individual contacts within the group
				            insertMessages(partialItem, contacts, function() {
				            	loadViewPage(req, res);
				            });
				        }
					});
				} else {
					loadViewPage(req, res);
				}
			});
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/add-group.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const groupName = req.body.groupName;
			const groupDeferredMessage = req.body.groupDeferredMessage;
				
			if (!objValid(groupName)) {
				loadAddGroupPage(req, res, "Please enter a value", "red");
				return;
			}

			const group = {
				warehouseId: req.user.warehouseId,
				name: groupName,
				deferredMessage: objValid(groupDeferredMessage) ? groupDeferredMessage : "",
			};

			insertGroup(group, function(error) {
				let statusColour = "green";
				let status = "Successfully added group";

				if (error) {
					statusColour = "red";
					status = "Unable to add group";
				}

				loadAddGroupPage(req, res, status, statusColour);
			});
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/add-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const colleagueAddress = req.body.colleagueAddress;
			let colleagueGroup = req.body.colleagueGroup;
			const colleaguePassword = req.body.colleaguePassword;
			const colleagueRole = req.body.colleagueRole;
			const colleagueFirstName = req.body.colleagueFirstName;
			const colleagueLastName = req.body.colleagueLastName;
			const firstColleaguePassword = req.body.firstColleaguePassword;
			
			if (!objValid(colleagueGroup) && colleagueRole === 'Admin') {
				colleagueGroup = 'Administrator';
			}

			if (!objValid(colleagueAddress) || !objValid(colleagueGroup) || !objValid(colleaguePassword) || !objValid(colleagueRole) || !objValid(colleagueFirstName) || !objValid(colleagueLastName) || !objValid(firstColleaguePassword)) {
				loadAddColleaguePage(req, res, "Please fill out all fields", "red");
				return;
			}

			if (colleaguePassword !== firstColleaguePassword) {
				loadAddColleaguePage(req, res, "Passwords do not match", "red");
				return;
			}

			const colleague = {
				warehouseId: req.user.warehouseId,
				address: colleagueAddress,
				group: colleagueGroup,
				password: colleaguePassword,
				role: colleagueRole,
				firstName: colleagueFirstName,
				lastName: colleagueLastName,
			};

			insertColleague(colleague, function(error) {
				let statusColour = "green";
				let status = "Successfully added colleague";

				if (error) {
					statusColour = "red";
					status = "Unable to add colleague";
				}

				loadAddColleaguePage(req, res, status, statusColour);
			});
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/delete-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const address = req.body.address;
			
			if (!objValid(address)) {
				//TODO - notify user?
				return;
			}

			const contact = {
				warehouseId: req.user.warehouseId,
				address: address,
			};

			deleteContact(contact, function(error) {
				loadDeleteColleaguePage(req, res);
			});
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/delete-group.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const groupName = req.body.groupName;
			
			if (!objValid(groupName)) {
				//TODO - notify user?
				return;
			}

			const group = {
				warehouseId: req.user.warehouseId,
				name: groupName,
			};

			deleteGroup(group, function(error) {
				//get all colleagues that are in this deleted group
				//params to get all contacts in group
				let contactParams = {
				    TableName: process.env.CONTACT_TABLE_NAME,
				    FilterExpression: '#group = :group',
				    ExpressionAttributeNames: {
				        "#group": "group",
				    },
				    ExpressionAttributeValues: {
				        ":group": groupName,
				    },
				};

				let emptyContactsArray = [];
				scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
					//pass contacts array to the loop update method to move orphans to 'Inactive' group
					setColleagueGroup(contacts, 'Inactive', function() {
						loadDeleteGroupPage(req, res);
					});
				});
			});
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/edit-group.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const previousGroupName = req.body.previousGroupName;
			const newDeferredMessage = req.body.newDeferredMessage;
			
			if (!objValid(previousGroupName)) {
				//TODO - notify user?
				return;
			}

			if (!objValid(newDeferredMessage)) {
				//TODO - notify user?
				return;
			}

			setGroupDeferredMessage(req.user.warehouseId, previousGroupName, newDeferredMessage, function() {
				loadEditGroupPage(req, res);
			});
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/edit-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const previousColleagueAddress = req.body.previousColleagueAddress;
			let newColleagueGroup = req.body.newColleagueGroup;
			const newColleagueRole = req.body.newColleagueRole;
			
			console.log(previousColleagueAddress);
			console.log(newColleagueGroup);
			console.log(newColleagueRole);

			if (!objValid(previousColleagueAddress)) {
				//TODO - notify user?
				return;
			}

			if (!objValid(newColleagueGroup) && newColleagueRole === 'Admin') {
				newColleagueGroup = 'Administrator';
			}

			if (!objValid(newColleagueGroup)) {
				//TODO - notify user?
				return;
			}

			if (!objValid(newColleagueRole)) {
				//TODO - notify user?
				return;
			}

			const updateParams = {
			    TableName: process.env.CONTACT_TABLE_NAME,
			    Key: {
			        warehouseId: req.user.warehouseId,
			        address: previousColleagueAddress,
			    },
			    UpdateExpression: 'SET #group = :group, #role = :role',
			    ExpressionAttributeNames: {
			        "#group": "group",
			        "#role": "role",
			    },
			    ExpressionAttributeValues: {
			        ":group": newColleagueGroup,
			        ":role": newColleagueRole,
			    },
			};

			dynamoDb.update(updateParams, (error) => {
	            //handle potential errors
		    	if (error) {
		        	console.error(error);
		    	}

	            loadEditColleaguePage(req, res);
	        });
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/view.html/archive", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const to = req.query.selected;

			//default view all params
	    	let filterExpression = 'begins_with(#id, :warehouseId)';
	    	let expressionAttributeNames = {
	    	    "#id": "id",
	    	};
	    	let expressionAttributeValues = {
	    	    ":warehouseId": req.user.warehouseId,
	    	};

	    	//do we have a query string param?
	    	if (objValid(to)) {
	    		filterExpression += ' AND #id = :id OR #id2 = :id2 AND #from = :from';
				expressionAttributeNames['#id'] = "id";
				expressionAttributeNames['#id2'] = "id";
				expressionAttributeNames['#from'] = "from";
				expressionAttributeValues[':id'] = req.user.warehouseId + "£" + to;
				expressionAttributeValues[':id2'] = req.user.warehouseId + "£" + req.user.address;
				expressionAttributeValues[':from'] = to;
	    	}

	        let messageParams = {
	        	TableName: process.env.MESSAGE_TABLE_NAME,
	        	FilterExpression: filterExpression,
	        	ExpressionAttributeNames: expressionAttributeNames,
	        	ExpressionAttributeValues: expressionAttributeValues,
	        };

	        let emptyMessagesArray = [];
	        scanMessages(messageParams, emptyMessagesArray, function(error, messages) {
	        	let messagesToDelete = JSON.parse(JSON.stringify(messages));

	        	//insert messages to archive table
	        	insertMessageArchives(messages, function() {
	        		//delete messages from message table
	        		deleteMessages(messagesToDelete, function() {
	        			res.redirect('/view.html?selected=' + to);
	        		});
	        	});
	        });
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/view-devices.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const deviceId = req.body.deviceId;
			
			if (!objValid(deviceId)) {
				//TODO - notify user?
				return;
			}

			deleteDevice(deviceId, function(error) {
				loadViewDevicesPage(req, res);
			});
		} else {
			res.sendFile(__dirname + "/restricted-access.html");
		}
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

//init service
app.listen(process.env.PORT, function() {
	console.log("Server started on port " + process.env.PORT);
});

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
			callback(true);
		} else {
			callback(false);
		}
	});
}

//utils
function generateTimestamp() {
    let d = new Date();
    d.setTime(d.getTime() + (60 * 60 * 1000));
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

//sorting/filtering methods
function sortGroupsAndContactsForColleagues(groups, contacts, currentUser) {
	const map = new Map();

	for (let x = 0; x < groups.length; x++) {
		const group = groups[x];
		map.set(group.name, filterColleagueContacts(contacts, group.name, currentUser));
	}

	return map;
}

function sortGroupsAndContactsForSupervisors(groups, contacts, currentUser) {
	const map = new Map();

	for (let x = 0; x < groups.length; x++) {
		const group = groups[x];
		map.set(group.name, filterSupervisorContacts(contacts, group.name, currentUser));
	}

	return map;
}

function filterColleagueContacts(contacts, name, currentUser) {
	let filteredContacts = [];

	for (let x = 0; x < contacts.length; x++) {
		const contact = contacts[x];
		if (contact.group === name && contact.role === 'Standard' && contact.address !== currentUser) {
			filteredContacts.push(contact);
		}
	}

	return filteredContacts;
}

function filterSupervisorContacts(contacts, name, currentUser) {
	let filteredContacts = [];

	for (let x = 0; x < contacts.length; x++) {
		const contact = contacts[x];
		if (contact.group === name && contact.role === 'Admin' && contact.address !== currentUser) {
			filteredContacts.push(contact);
		}
	}

	return filteredContacts;
}

function sortMessages(messages) {
	messages.sort((a, b) => {
		const comp1 = a.timestamp;
		const comp2 = b.timestamp;

		if (comp1 < comp2) {
			return -1;
		}

		if (comp1 > comp2) {
			return 1;
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
		            let messageParams = {
		            	TableName: process.env.MESSAGE_TABLE_NAME,
		            	FilterExpression: 'begins_with(#id, :warehouseId)',
		            	ExpressionAttributeNames: {
		            	    "#id": "id",
		            	},
		            	ExpressionAttributeValues: {
		            	    ":warehouseId": req.user.warehouseId,
		            	},
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
        			            	address: req.user.address,
        			            	role: req.user.role,
        			            	warehouseId: req.user.warehouseId,
        			            	messages: sortMessages(messages),
        			            	groupContactMapForColleagues: sortGroupsAndContactsForColleagues(groups, contacts, req.user.address),
        			            	groupContactMapForSupervisors: sortGroupsAndContactsForSupervisors(groups, contacts, req.user.address),
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
    			res.render("delete-colleague", {
            		address: req.user.address,
            		role: req.user.role,
                	warehouseId: req.user.warehouseId,
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
		    //groups OK, now show screen
			res.render("delete-group", {
        		address: req.user.address,
        		role: req.user.role,
            	warehouseId: req.user.warehouseId,
            	groups: groups,
        	});
		}
	});
}

function loadEditGroupPage(req, res) {
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
		    //groups OK, now show screen
			res.render("edit-group", {
        		address: req.user.address,
        		role: req.user.role,
            	warehouseId: req.user.warehouseId,
            	groups: groups,
            	editableGroup: req.query.editableGroup,
        	});
		}
	});
}

function loadEditColleaguePage(req, res) {
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
            		address: req.user.address,
            		role: req.user.role,
                	warehouseId: req.user.warehouseId,
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
		if (error !== null) {
		    //TODO - error scenario
		} else if (messageReceipts === null || messageReceipts.length < 1) {
		    //TODO - error scenario
		} else {
		    //message receipts OK, now show screen
			res.render("group-message-info", {
            	messageReceipts: messageReceipts,
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
	        	address: req.user.address,
	        	role: req.user.role,
	        	warehouseId: req.user.warehouseId,
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
				res.render("add-colleague", {
		        	address: req.user.address,
		        	role: req.user.role,
		        	warehouseId: req.user.warehouseId,
		        	statusColour: "",
		        	status: "",
		        	groups: groups,
		        });
			});
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
				
			if (!objValid(groupName)) {
				//TODO - notify user?
				return;
			}

			const group = {
				warehouseId: req.user.warehouseId,
				name: groupName,
			};

			insertGroup(group, function(error) {
				let statusColour = "green";
				let status = "Successfully added group";

				if (error) {
					statusColour = "red";
					status = "Unable to add group";
				}

				res.render("add-group", {
		        	address: req.user.address,
		        	role: req.user.role,
		        	warehouseId: req.user.warehouseId,
		        	statusColour: statusColour,
		        	status: status,
		        });
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
			const colleagueGroup = req.body.colleagueGroup;
			const colleaguePassword = req.body.colleaguePassword;
			const colleagueRole = req.body.colleagueRole;
			
			if (!objValid(colleagueAddress) || !objValid(colleagueGroup) || !objValid(colleaguePassword) || !objValid(colleagueRole)) {
				//TODO - notify user?
				return;
			}

			const colleague = {
				warehouseId: req.user.warehouseId,
				address: colleagueAddress,
				group: colleagueGroup,
				password: colleaguePassword,
				role: colleagueRole,
			};

			insertColleague(colleague, function(error) {
				let statusColour = "green";
				let status = "Successfully added colleague";

				if (error) {
					statusColour = "red";
					status = "Unable to add colleague";
				}

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
					res.render("add-colleague", {
			        	address: req.user.address,
			        	role: req.user.role,
			        	warehouseId: req.user.warehouseId,
			        	statusColour: statusColour,
			        	status: status,
			        	groups: groups,
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
					//pass contacts array to the loop update method to move orphans to 'Other' group
					setColleagueGroup(contacts, 'Other', function() {
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
			const newGroupName = req.body.newGroupName;
			
			if (!objValid(previousGroupName)) {
				//TODO - notify user?
				return;
			}

			if (!objValid(newGroupName)) {
				//TODO - notify user?
				return;
			}

			//because the name is a composite key, the record has to be deleted & inserted
			const previousGroup = {
				warehouseId: req.user.warehouseId,
				name: previousGroupName,
			};

			deleteGroup(previousGroup, function(error) {
				//now insert new group
				const newGroup = {
					warehouseId: req.user.warehouseId,
					name: newGroupName,
				};

				insertGroup(newGroup, function(error) {
					//get all colleagues that were in the deleted group
					//params to get all contacts in group
					let contactParams = {
					    TableName: process.env.CONTACT_TABLE_NAME,
					    FilterExpression: '#group = :group',
					    ExpressionAttributeNames: {
					        "#group": "group",
					    },
					    ExpressionAttributeValues: {
					        ":group": previousGroupName,
					    },
					};

					let emptyContactsArray = [];
					scanContacts(contactParams, emptyContactsArray, function(error, contacts) {
						//pass contacts array to the loop update method to move orphans to new group
						setColleagueGroup(contacts, newGroupName, function() {
							loadEditGroupPage(req, res);
						});
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

app.post("/edit-colleague.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		if (req.user.role === 'Admin') {
			const previousColleagueAddress = req.body.previousColleagueAddress;
			const newColleagueGroup = req.body.newColleagueGroup;
			const newColleagueRole = req.body.newColleagueRole;
			
			if (!objValid(previousColleagueAddress)) {
				//TODO - notify user?
				return;
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

//init service
app.listen(process.env.PORT, function() {
	console.log("Server started on port " + process.env.PORT);
});

const jwt = require('jsonwebtoken');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const queryString = require('query-string');
const privateKey = fs.readFileSync(path.resolve(__dirname, '../server.key'));

exports.leadModalSubmissionHandler = async (body, client) => {
	try {
		const channel = JSON.parse(body.view.private_metadata).channel;
		const { userId, userEmail } = await getUserInfoFromSlack(body, client);
		const leadObject = {
			Country: 'Australia',
			LeadSource: 'Partner Referral'
		};
		const values = body.view.state.values;
		const valueKeys = Object.keys(values);
		let data = {};
		valueKeys.forEach(key => {
			data = { ...data, ...values[key] };
		});
		leadObject.FirstName = data['first_name'].value;
		leadObject.LastName = data['last_name'].value;
		leadObject.Title = data['title'].value;
		if (data['office_phone'] && data['office_phone'].value)
			leadObject.Phone = data['office_phone'].value;
		if (data['mobile_phone'] && data['mobile_phone'].value)
			leadObject.MobilePhone = data['mobile_phone'].value;
		leadObject.Email = data['email'].value;
		leadObject.Company = data['company'].value;
		if (
			data['salesforce_account_vertical'] &&
			data['salesforce_account_vertical'].selected_option &&
			data['salesforce_account_vertical'].selected_option.value
		)
			leadObject.Salesforce_Account_Vertical__c =
				data['salesforce_account_vertical'].selected_option.value;
		if (
			data["how_many_fte's_do_they_have?"] &&
			data["how_many_fte's_do_they_have?"].selected_option &&
			data["how_many_fte's_do_they_have?"].selected_option.value
		)
			leadObject.How_many_FTE_s_do_they_have__c =
				data["how_many_fte's_do_they_have?"].selected_option.value;
		leadObject.Opportunity_Type__c =
			data['opportunity_type'].selected_option.value;
		if (data['street'] && data['street'].value)
			leadObject.Street = data['street'].value;
		if (data['city'] && data['city'].value)
			leadObject.City = data['city'].value;
		if (
			data['state/province'] &&
			data['state/province'].selected_option &&
			data['state/province'].selected_option.value
		)
			leadObject.State = data['state/province'].selected_option.value;
		if (data['postcode'] && data['postcode'].value)
			leadObject.Postalcode = data['postcode'].value;
		leadObject.Added_to_QUIP_Notes__c =
			data['notes_radio'].selected_option.value;
		handleLeadDataUpload(leadObject, userId, userEmail, client, channel);
	} catch (error) {
		console.log(error);
	}
};

function getUserInfoFromSlack(body, client) {
	return new Promise(async (resolve, reject) => {
		try {
			const userId = body.user.id;
			const userData = await client.users.info({
				token: process.env.access_token,
				user: userId
			});

			const userEmail = userData.user.profile.email;
			resolve({ userId, userEmail });
		} catch (error) {
			reject(error);
		}
	});
}

async function handleLeadDataUpload(
	leadObject,
	userId,
	userEmail,
	client,
	channel
) {
	try {
		const authToken = await getSalesForceAuthToken();
		const contactDetails = await getContactFromSF(authToken, userId, userEmail);
		if (contactDetails.records.length) {
			if (contactDetails.records[0].AccountId) {
				leadObject.Referred_From_Business__c =
					contactDetails.records[0].AccountId;
			}
			if (contactDetails.records[0].Id) {
				leadObject.Referral_From__c = contactDetails.records[0].Id;
				leadObject.Current_AE__c = contactDetails.records[0].Id;
			}
		}
		// console.log(leadObject);
		uploadSalesforceLeadData(authToken, leadObject, userId, client, channel);
	} catch (error) {
		console.log(error);
	}
}

async function uploadSalesforceLeadData(
	authToken,
	leadObject,
	userId,
	client,
	channel
) {
	try {
		const response = await axios.post(
			'https://solbusiness.my.salesforce.com/services/data/v50.0/sobjects/Lead/',
			leadObject,
			{
				headers: {
					Authorization: 'Bearer ' + authToken
				}
			}
		);

		const message = 'Lead Data Added to SalesForce Successfully.';
		sendMessageToSlackUser('success', message, userId, client, channel);
	} catch (error) {
		let message = 'Something went Wrong. Unable to Save Lead Data.';
		if (error.response.data && error.response.data[0].errorCode) {
			const errorMessage = error.response.data[0].message;
			if (errorMessage.includes('Email: invalid email address'))
				message = 'Invalid Email Address';
			else message = errorMessage;
		}

		sendMessageToSlackUser('error', message, userId, client, channel);
	}
}

async function sendMessageToSlackUser(
	messageType,
	message,
	userId,
	client,
	channel
) {
	try {
		const messageAttachments = {
			color: messageType === 'success' ? '#198754' : '#dc3545',
			blocks: [
				{
					type: 'header',
					text: {
						type: 'plain_text',
						text:
							messageType === 'success'
								? 'Lead Data Upload Successful'
								: 'Lead Data Upload Unsuccessful',
						emoji: true
					}
				},
				{
					type: 'context',
					elements: [
						{
							type: 'mrkdwn',
							text: `*${message}*`
						}
					]
				}
			]
		};

		await client.chat.postEphemeral({
			token: process.env.access_token,
			channel: channel.startsWith('D') ? userId : channel,
			user: userId,
			attachments: [messageAttachments]
		});
	} catch (error) {
		console.log(error);
	}
}

function getContactFromSF(authToken, userId, userEmail) {
	return new Promise(async (resolve, reject) => {
		try {
			const response = await axios.get(
				`https://solbusiness.my.salesforce.com/services/data/v50.0/query?q=SELECT+id,AccountId+FROM+contact+WHERE+email='${userEmail}'+OR+Slack_Member_ID__c='${userId}'`,
				{
					headers: {
						Authorization: 'Bearer ' + authToken
					}
				}
			);

			resolve(response.data);
		} catch (error) {
			reject(error);
		}
	});
}

function getSalesForceAuthToken() {
	return new Promise(async (resolve, reject) => {
		try {
			const assertion = jwt.sign(
				{
					iss:
						'3MVG9uudbyLbNPZPotaU61z_pKGa0pODCCDbzXOVZf2HTs9cm_aNMCTm8R0SqBQL0Pkyiob3tVPxrmtdEWvZN',
					sub: 'dev@solbusiness.com.au',
					aud: 'https://login.salesforce.com',
					exp: Date.now()
				},
				privateKey,
				{ algorithm: 'RS256' }
			);

			const data = {
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: assertion
			};

			const res = await axios.post(
				'https://login.salesforce.com/services/oauth2/token',
				queryString.stringify(data),
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}
			);
			const token = res.data.access_token;

			resolve(token);
		} catch (error) {
			reject(error);
		}
	});
}

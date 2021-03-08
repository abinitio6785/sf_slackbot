const jwt = require('jsonwebtoken');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const queryString = require('query-string');
const privateKey = fs.readFileSync(path.resolve(__dirname, '../server.key'));

exports.leadModalHandler = async (body, client) => {
	try {
		const result = await client.views.open({
			trigger_id: body.trigger_id,
			view: await generateLeadModalView(body)
		});
	} catch (error) {
		console.error(error);
	}
};

function generateLeadModalView(body) {
	return new Promise(async (resolve, reject) => {
		try {
			const blocks = await generateViewBlocks();
			const modalView = {
				type: 'modal',
				callback_id: 'lead_modal',
				title: {
					type: 'plain_text',
					text: 'SOL Business Lead'
				},
				private_metadata: JSON.stringify({ channel: body.channel.id }),
				blocks: [...blocks],
				submit: {
					type: 'plain_text',
					text: 'Submit'
				}
			};
			resolve(modalView);
		} catch (error) {
			reject(error);
		}
	});
}

async function generateViewBlocks() {
	let viewBlocks = [];

	const blocksHeader = generateBlockHeader();
	const customerDetailsBlocks = generateCustomerDetailsBlocks();
	const businessInformationBlocks = generateBusinessInformationBlocks();
	const locationBlocks = generateLocationBlocks();
	const notesBlock = generateNotesBlock();
	viewBlocks = [
		blocksHeader,
		...customerDetailsBlocks,
		...businessInformationBlocks,
		...locationBlocks,
		notesBlock
	];

	return viewBlocks;
}

function generateBlockHeader() {
	return {
		type: 'section',
		text: {
			type: 'plain_text',
			text:
				'Please use this form to submit a new lead to SOL Business Solutions. To ensure we are best prepared for every customer meeting - No meeting invites will be locked in unless this form is submitted.',
			emoji: true
		}
	};
}

function generateCustomerDetailsBlocks() {
	const customerDetailBlocks = [];

	const header = generateHeader('Customer Details');
	customerDetailBlocks.push(header);

	const firstNameInputField = generateInputFeld('First Name', false);
	customerDetailBlocks.push(firstNameInputField);

	const lastNameInputField = generateInputFeld('Last Name', false);
	customerDetailBlocks.push(lastNameInputField);

	const titleInputField = generateInputFeld('Title', false);
	customerDetailBlocks.push(titleInputField);

	const officePhoneInputField = generateInputFeld('Office Phone', true);
	customerDetailBlocks.push(officePhoneInputField);

	const mobilePhoneInputField = generateInputFeld('Mobile Phone', true);
	customerDetailBlocks.push(mobilePhoneInputField);

	const emailInputField = generateInputFeld('Email', false);
	customerDetailBlocks.push(emailInputField);

	return customerDetailBlocks;
}

function generateBusinessInformationBlocks() {
	const businessInformationBlocks = [];

	const header = generateHeader('Business Information');
	businessInformationBlocks.push(header);

	const companyInputField = generateInputFeld('Company', false);
	businessInformationBlocks.push(companyInputField);

	const salesForceAccountVerticalOptions = [
		'Agriculture & Mining',
		'Communications & Media',
		'Engineering, Construction & Real Estate',
		'Healthcare & Life Sciences',
		'High Tech',
		'Manufacturing',
		'Professional Services',
		'Retail & CG'
	];
	const salesForceAccountVerticalInputField = generateExternalSelectField(
		'Salesforce Account Vertical',
		salesForceAccountVerticalOptions,
		true
	);
	businessInformationBlocks.push(salesForceAccountVerticalInputField);

	const fteSelectOptions = [
		'Self-employed',
		'1-10 employees',
		'11-50 employees',
		'51-200 employees',
		'201-500 employees',
		'501-1000 employees',
		'1001-5000 employees',
		'5001-10,000 employees',
		'10,001+ employees'
	];
	const fteCountInputField = generateExternalSelectField(
		"How many FTE's do they have?",
		fteSelectOptions,
		true
	);
	businessInformationBlocks.push(fteCountInputField);

	const opportunityTypeOptions = [
		'Implementation',
		'Health Check',
		'Consulting'
	];
	const opportunityTypeInputField = generateExternalSelectField(
		'Opportunity Type',
		opportunityTypeOptions,
		false
	);
	businessInformationBlocks.push(opportunityTypeInputField);

	return businessInformationBlocks;
}

function generateLocationBlocks() {
	const locationBlocks = [];

	const header = generateHeader('Location');
	locationBlocks.push(header);

	const streetInputField = generateInputFeld('Street', true);
	locationBlocks.push(streetInputField);

	const cityInputField = generateInputFeld('City', true);
	locationBlocks.push(cityInputField);

	const stateOptions = [
		'Australian Capital Territory',
		'New South Wales',
		'Northern Territory',
		'Queensland',
		'South Australia',
		'Tasmania',
		'Victoria',
		'Western Australia'
	];
	const stateProvinceInputField = generateExternalSelectField(
		'State/Province',
		stateOptions,
		true
	);
	locationBlocks.push(stateProvinceInputField);

	const postcodeInputField = generateInputFeld('Postcode', true);
	locationBlocks.push(postcodeInputField);

	return locationBlocks;
}

function generateNotesBlock() {
	return {
		type: 'input',
		element: {
			type: 'radio_buttons',
			options: [
				{
					text: {
						type: 'plain_text',
						text: 'Yes',
						emoji: true
					},
					value: 'true'
				},
				{
					text: {
						type: 'plain_text',
						text: 'No',
						emoji: true
					},
					value: 'false'
				}
			],
			action_id: 'notes_radio'
		},
		label: {
			type: 'plain_text',
			text: 'Added Jimmy to any QUIP notes or sent through notes? ',
			emoji: true
		}
	};
}

function generateHeader(headerText) {
	return {
		type: 'header',
		text: {
			type: 'plain_text',
			text: headerText,
			emoji: true
		}
	};
}

function generateInputFeld(labelText, optional) {
	const inputField = {
		type: 'input',
		element: {
			type: 'plain_text_input',
			placeholder: {
				type: 'plain_text',
				text: labelText,
				emoji: true
			},
			action_id: lowerAndUnderscoreString(labelText)
		},
		label: {
			type: 'plain_text',
			text: labelText,
			emoji: true
		},
		optional: optional
	};

	if (labelText === 'Email') {
		inputField.hint = {
			type: 'plain_text',
			text: 'Enter a valid email address (ex: example@example.com)',
			emoji: true
		};
	}

	return inputField;
}

function generateExternalSelectField(labelText, options, optional) {
	options = options.map(option => {
		return {
			text: {
				type: 'plain_text',
				text: option
			},
			value: option
		};
	});

	return {
		type: 'input',
		element: {
			type: 'static_select',
			placeholder: {
				type: 'plain_text',
				text: 'Select an item',
				emoji: true
			},
			options: options,
			action_id: lowerAndUnderscoreString(labelText)
		},
		label: {
			type: 'plain_text',
			text: labelText,
			emoji: true
		},
		optional: optional
	};
}

function lowerAndUnderscoreString(text) {
	return text.toLowerCase().replace(/ /g, '_');
}

function getPickListsFromSalesForce() {
	return new Promise(async (resolve, reject) => {
		try {
			const salesForceAuthToken = await getSalesForceAuthToken();
			const response = await axios.get(
				'https://solbusiness.my.salesforce.com/services/data/v50.0/sobjects/lead/describe',
				{
					headers: {
						Authorization: 'Bearer ' + salesForceAuthToken
					}
				}
			);
			const pickLists = response.data.fields.filter(
				field => field.type === 'picklist'
			);
			resolve(pickLists);
		} catch (error) {
			console.log(error?.response?.data);
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

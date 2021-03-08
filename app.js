const { App } = require('@slack/bolt');
const dotenv = require('dotenv').config();

const { leadModalHandler } = require('./views/leadModal');
const { leadModalSubmissionHandler } = require('./controllers/leadModal');

const app = new App({
	token: process.env.access_token,
	signingSecret: process.env.signing_secret,
	clientId: process.env.clientI_id,
	clientSecret: process.env.client_secret
});

app.command('/lead', async ({ ack, body, client }) => {
	try {
		await ack();
		body.channel = { id: body.channel_id };
		leadModalHandler(body, client);
	} catch (error) {
		console.log(error);
	}
});

app.event('app_mention', async ({ event, client }) => {
	try {
		await client.chat.postEphemeral({
			token: process.env.access_token,
			channel: event.channel.startsWith('D') ? event.user : event.channel,
			user: event.user,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: 'Please click on the button below to open lead modal.'
					}
				},
				{
					type: 'actions',
					elements: [
						{
							type: 'button',
							style: 'primary',
							text: {
								type: 'plain_text',
								text: 'Open Lead Modal',
								emoji: true
							},
							action_id: 'lead_modal'
						}
					]
				}
			]
		});
	} catch (error) {
		console.log(error);
	}
});

(async () => {
	try {
		await app.start(process.env.PORT || 3000);
		console.log('Solbot is running!');
	} catch (error) {
		console.log(error);
	}
})();

app.view('lead_modal', async ({ ack, body, client }) => {
	try {
		await ack();
		leadModalSubmissionHandler(body, client);
	} catch (error) {
		console.log(error);
	}
});

app.action('lead_modal', async ({ ack, body, client }) => {
	try {
		await ack();
		leadModalHandler(body, client);
	} catch (error) {
		console.log(error);
	}
});

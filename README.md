# Connect Stats
Shows current Connect inventory, using a Connect Backup Config file.

Currently Displays:

- Channels
	- Source Data Type
	- Source Port (`HTTP and TCP as of now`)
	- Name
	- Enabled Status
	- Storage Type
	- Pruning State
	- Whether a Description is set
- Channel Groups
	- Name
	- Number of Channels
- Channel Tags
	- Name
	- Color
	- Number of Channels
- Listening Ports
	- Source Data Type
	- Source Port (`HTTP and TCP as of now`)
	- Channel Name
- No Pruning
	- Channel Name
- Non Production Storage
	- Channel Name
- No Descriptions
	- Channel Name

## Depdendencies
- JavaScript
	- [Vue.js](https://vuejs.org/)
	- [lodash](https://lodash.com/)
	- [nprogress](https://github.com/rstacruz/nprogress)
- CSS
	- [Bulma](https://bulma.io/)
	- [Font Awesome](https://fontawesome.com)

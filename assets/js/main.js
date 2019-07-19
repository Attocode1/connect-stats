Vue.component('channel-table', {
    props: ['channel-group', 'columns', 'cells', 'title'],
    template:
    `<table class="table is-striped is-fullwidth is-hoverable is-bordered">
        <thead>
            <tr class="has-background-grey-dark">    
                <th class="has-text-white" v-bind:colspan="columns.length">
                    {{ title }}: {{ channelGroup.length }}
                    <a href="#top" class="has-text-white" aria-label="Back to Top of Page">
                        <span class="icon is-pulled-right">
                            <i class="fas fa-angle-up" aria-hidden="true"></i>
                        </span>
                    </a>
                    </span>
                </th>
            </tr>
            <tr class="has-background-grey">    
                <th class="has-text-white" v-for="column in columns">{{ column }}</th>
            </tr>
        </thead>
        <tbody class="content is-small">
            <table-row
                v-for="channel in channelGroup"
                v-bind:row="channel"
                v-bind:cells="cells"
                v-bind:key="channel.id"
            ></table-row>
        </tbody>
    </table>
    `
})

Vue.component('table-row', {
    props: ['row', 'cells'],
    template: `
    <tr>
        <td v-for="cell in cells">
            <span v-if="cell == 'backgroundColor'" class="tag has-text-black" v-bind:style="{ backgroundColor: row[cell]}">{{ row[cell] }}</span>
            <span v-else-if="cell == 'enabled' && row[cell]">Enabled</span>
            <span v-else-if="cell == 'enabled' && !row[cell]" class="has-background-info has-text-white">Not Enabled</span>
            <span v-else-if="cell == 'messageStorageMode' && row['developmentStorage']" class="has-background-danger has-text-white">{{ row.messageStorageMode }}</span>
            <span v-else-if="cell == 'pruneMetaData' && !row['hasPruning']" class="has-background-danger has-text-white">No Pruning</span>
            <span v-else-if="cell == 'description' && !row['hasDescription']" class="has-background-danger has-text-white">No Description</span>
            <span v-else>{{ row[cell] }}</span>
        </td>
    </tr>
    `
})

let app = new Vue({
    el: '#app',
    data: {
        serverSettings: {},
        groups: {
            channels: { label: 'Channels', name: 'channels', tds: ['sourceConnector', 'port', 'name', 'enabled', 'messageStorageMode', 'pruneMetaData', 'description'], columns: ['Type', 'Port', 'Name', 'Enabled', 'Storage', 'Pruning (days)', 'Description'], items: [] },
            channelGroups: { label: 'Groups', name: 'channelGroups', tds: ['name', 'channelCount'], columns: ['Name', 'Channels'], items: [] },
            channelTags: { label: 'Tags', name: 'channelTags', tds: ['name', 'backgroundColor', 'channelCount'], columns: ['Name', 'Color', 'Channels'], items: [] },
            activePorts: { label: 'Ports', name: 'activePorts', tds: ['sourceConnector', 'port', 'name'], columns: ['Type', 'Port', 'Name'], items: [] },
            noMetadataPruning: { label: 'No Pruning', name: 'noMetadataPruning', tds: ['name'], columns: ['Name'], items: [] },
            nonProductionStorage: { label: 'Non-Production Storage', name: 'nonProductionStorage', tds: ['name'], columns: ['Name'], items: [] },
            noDescription: { label: 'No Description', name: 'noDescription', tds: ['name'], columns: ['Name'], items: [] }
        },
        showMessage: false,
        notification: [],
        currentReport: {
            lastModified: '',
            name: 'Choose a report…',
            size: '',
            type: ''
        },
        isLoaded: false,
        isLoading: false
    },
    methods: {
        onFileChange(e) {
            let files = e.target.files || e.dataTransfer.files;
            
            if(!files.length) {
                return;
            }

            if(files.length == 1) {
                NProgress.start();

                let lastModified = files[0].lastModified;
                let name = files[0].name;
                let size = files[0].size;
                let type = files[0].type;

                if(!this.isLoaded) {
                    this.currentReport.lastModified = lastModified;
                    this.currentReport.name = name;
                    this.currentReport.size = size;
                    this.currentReport.type = type;
                } else {
                    if(this.currentReport.lastModified == lastModified
                        && this.currentReport.name == name
                        && this.currentReport.size == size
                        && this.currentReport.type == type) {
                        return;
                    }

                    this.currentReport.lastModified = lastModified;
                    this.currentReport.name = name;
                    this.currentReport.size = size;
                    this.currentReport.type = type;
                }

                this.clearReport();

                if(_.isEqual(type, 'application/json')) {
                    this.loadJSONData(files[0]);
                } else if(_.isEqual(type, 'text/xml')) {
                    this.loadXMLData(files[0]);
                }
            }
        },
        loadXMLData(file) {
            let vm = this;
            let reader = new FileReader();

            reader.onloadstart = () => {
                vm.isLoaded = false;
                vm.isLoading = true;
            }

            reader.onloadend = () => {
                vm.isLoading = false;
            }

            reader.onload = (e) => {
                try {
                    let oParser = new DOMParser();
                    let oDom = oParser.parseFromString(e.target.result, 'application/xml');
                    this.parseXML(oDom);
                } catch(error) {
                    vm.setError('Error Parsing XML Export', error);
                }
            }

            reader.readAsText(file);
        },
        loadJSONData(file) {
            let reader = new FileReader();
            let vm = this;

            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);

                    Object.keys(jsonData).forEach(key => {
                        vm[key] = jsonData[key];
                    });

                    vm.showMessage = false;
                    vm.isLoaded = true;
                    vm.persist();
                } catch(error) {
                    vm.setError('Malformed JSON report', error);
                }
            }

            reader.readAsText(file);
        },
        parseXML(document) {
            if(!_.isNull(document) && !_.isUndefined(document)) {
                let vm = this;
                vm.isLoaded = true;
                let config = this.getElements(document, 'serverConfiguration')[0];
                let serverSettings = this.getElements(config, 'serverSettings')[0];

                vm.serverSettings = {
                    serverName: this.getText(this.getElements(serverSettings, 'serverName')[0], 'serverName'),
                    version: config.getAttribute('version').toString(),
                    queueBufferSize: this.getText(this.getElements(serverSettings, 'queueBufferSize')[0], 'queueBufferSize')
                };

                let channelGroupsXML = this.getElements(this.getElements(config, 'channelGroups')[0], 'channelGroup');
                let channelGroups = [];

                for(let channelGroup of channelGroupsXML) {
                    var channelGroupObj = {
                        'id': this.getText(this.getElements(channelGroup, 'id')[0], 'id'),
                        'name': this.getText(this.getElements(channelGroup, 'name')[0], 'name'),
                        'channelCount': this.getElements(this.getElements(channelGroup, 'channels')[0], 'channel').length
                    };
                
                    channelGroups.push(channelGroupObj);
                }

                channelGroups = _.sortBy(channelGroups, ['name']);
                vm.groups.channelGroups.items = channelGroups;
                
                let channelTagsXML = this.getElements(this.getElements(config, 'channelTags')[0], 'channelTag');
                let channelTags = [];

                for(let channelTag of channelTagsXML) {
                    let bgColor = this.getElements(channelTag, 'backgroundColor')[0];
                    let red = this.getText(this.getElements(bgColor, 'red')[0], 'red'); 
                    let green = this.getText(this.getElements(bgColor, 'green')[0], 'green');
                    let blue = this.getText(this.getElements(bgColor, 'blue')[0], 'blue');
                    let alpha = this.getText(this.getElements(bgColor, 'alpha')[0], 'alpha');
                
                    let channelTagObj = {
                        'id': this.getText(this.getElements(channelTag, 'id')[0], 'id'),
                        'name': this.getText(this.getElements(channelTag, 'name')[0], 'name'),
                        'channelCount': this.getElements(this.getElements(channelTag, 'channelIds')[0], 'string').length,
                        'backgroundColor': `rgb(${red},${green},${blue},${alpha})`
                    };
                
                    channelTags.push(channelTagObj);
                }

                channelTags = _.sortBy(channelTags, ['name']);
                vm.groups.channelTags.items = channelTags;

                let allChannelsXML = this.getElements(config, 'channels');
                let channelsXML;
                let channels = [];
                let nonProductionStorage = [];
                let noMetadataPruning = [];
                let noDescription = [];
                let activePorts = [];

                for(let allChannel of allChannelsXML) {
                    if(_.isEqual(allChannel.parentNode.localName.toString(), 'serverConfiguration')) {
                        channelsXML = this.getElements(allChannel, 'channel');
                    }
                }

                for(let channel of channelsXML) {
                    let name = this.getText(this.getElements(channel, 'name')[0], 'name');
                    let properties;

                    for(let prop of this.getElements(channel, 'properties')) {
                        if(_.isEqual(prop.parentNode.localName.toString(), 'channel')) {
                            properties = prop;
                        }
                    }

                    let metadata = this.getElements(this.getElements(channel, 'exportData')[0], 'metadata')[0];
                    let description = this.getElements(channel, 'description')[0].innerHTML.toString();

                    let pruningSettings = this.getElements(metadata, 'pruningSettings');
                    let pruneMetaData = '';
                    let pruneContentDays = '';

                    if(pruningSettings.length == 1) {
                        pruningSettings = pruningSettings[0];

                        pruneMetaData = this.getElements(pruningSettings, 'pruneMetaDataDays');
                        if(pruneMetaData.length == 1) {
                            pruneMetaData = pruneMetaData[0].innerHTML.toString();
                        } else {
                            pruneMetaData = ''
                        }

                        pruneContentDays = this.getElements(pruningSettings, 'pruneContentDays');
                        if(pruneContentDays.length == 1) {
                            pruneContentDays = pruneContentDays[0].innerHTML.toString();
                        } else {
                            pruneContentDays = ''
                        }
                    }

                    let sourceConnector = this.getElements(channel, 'sourceConnector')[0];
                    let sourceProperties = this.getElements(sourceConnector, 'properties')[0];
                    
                    let connectorType = sourceProperties.getAttribute('class').toString();
                    connectorType = _.upperCase(_.split(connectorType, '.', 5).pop());
                
                    var channelObj = {
                        'id': this.getElements(channel, 'id')[0].innerHTML.toString(),
                        'name': name,
                        'prettyName': _.startCase(name),
                        'messageStorageMode': _.upperFirst(_.lowerCase(this.getText(this.getElements(properties, 'messageStorageMode')[0], 'messageStorageMode'))),
                        'developmentStorage': false, 
                        'hasPruning': false,
                        'pruneMetaData': pruneMetaData,
                        'pruneContent': pruneContentDays,
                        'hasDescription': false,
                        'sourceConnector': connectorType,
                        'description': description.substring(0, 25),
                        'host': '',
                        'port': '',
                        'isDanger': false,
                        'enabled': (this.getText(this.getElements(metadata, 'enabled')[0], 'enabled') == 'true')
                    };

                    if(_.includes(['TCP', 'HTTP'], connectorType)) {
                        let listenerProperties = this.getElements(sourceProperties, 'listenerConnectorProperties')[0];
                        let host = this.getText(this.getElements(listenerProperties, 'host')[0], 'host');
                        let port = this.getText(this.getElements(listenerProperties, 'port')[0], 'port');

                        channelObj.host = host;
                        channelObj.port = port;

                        let portObj = {
                            port: port,
                            name: channelObj.name,
                            enabled: channelObj.enabled,
                            sourceConnector: channelObj.sourceConnector
                        }
                        
                        activePorts.push(portObj);
                    }
                
                    if(channelObj.messageStorageMode.indexOf('Development') > -1) {
                        channelObj.developmentStorage = true;
                        nonProductionStorage.push(channelObj);
                    }
                
                    if(channelObj.pruneMetaData == '') {
                        noMetadataPruning.push(channelObj);
                    } else {
                        channelObj.hasPruning = true;
                    }
                
                    if(channelObj.description != '') {
                        channelObj.description += ' ...';
                        channelObj.hasDescription = true;
                    }
                
                    if(!channelObj.hasDescription) {
                        noDescription.push(channelObj);
                    }
                
                    if(!channelObj.hasPruning && !channelObj.hasDescription) {
                        channelObj.isDanger = true;
                    }
                
                    channels.push(channelObj);
                }

                nonProductionStorage = _.sortBy(nonProductionStorage, ['name']);
                vm.groups.nonProductionStorage.items = nonProductionStorage;
                
                noDescription = _.sortBy(noDescription, ['name']);
                vm.groups.noDescription.items = noDescription;
                
                noMetadataPruning = _.sortBy(noMetadataPruning, ['name']);
                vm.groups.noMetadataPruning.items = noMetadataPruning;

                channels = _.sortBy(channels, ['name']);
                vm.groups.channels.items = channels;

                activePorts = _.sortBy(activePorts, ['type', 'port', 'name']);
                vm.groups.activePorts.items = activePorts;

                NProgress.done();
            }
        },
        getText(element, tagName) {
            if(!_.isNull(element) && !_.isUndefined(element) && !isBlank(tagName)) {
                try {
                    return element.innerHTML.toString();
                } catch(error) {
                    this.setError(`Could not get text (${tagName}):`, error);
                }
            } else {
                return '';
            }
        },
        getElements(document, name) {
            if(!isBlank(name)) {
                try {
                    return document.getElementsByTagName(name);
                } catch(error) {
                    this.setError(`Coudld not get element (${name})`, error);
                }
            } else {
                return null;
            }
        },
        setNotification(msg, exp) {
            let msgText = 'Error message not passed';

            if(!isBlank(msg)) {
                msgText = `<strong>${msg}</strong><br/>`;
            }

            if(!_.isNull(exp) && !_.isUndefined(exp)) {
                msgText = `${msgText}Line: ${exp.lineNumber}<br/>${exp.toString()}`;
            }

            this.notification.push(msgText);
        },
        setError(message, exception) {
            this.showMessage = true;
            this.isLoading = false;
            this.isLoaded = false;
            this.setNotification(message, exception);
            NProgress.done();
        },
        clearReport() {
            var data = {
                serverSettings: {},
                groups: {
                    channels: { label: 'Channels', name: 'channels', tds: ['sourceConnector', 'port', 'name', 'enabled', 'messageStorageMode', 'pruneMetaData', 'description'], columns: ['Type', 'Port', 'Name', 'Enabled', 'Storage', 'Pruning (days)', 'Description'], items: [] },
                    channelGroups: { label: 'Groups', name: 'channelGroups', tds: ['name', 'channelCount'], columns: ['Name', 'Channels'], items: [] },
                    channelTags: { label: 'Tags', name: 'channelTags', tds: ['name', 'backgroundColor', 'channelCount'], columns: ['Name', 'Color', 'Channels'], items: [] },
                    activePorts: { label: 'Ports', name: 'activePorts', tds: ['sourceConnector', 'port', 'name'], columns: ['Type', 'Port', 'Name'], items: [] },
                    noMetadataPruning: { label: 'No Pruning', name: 'noMetadataPruning', tds: ['name'], columns: ['Name'], items: [] },
                    nonProductionStorage: { label: 'Non-Production Storage', name: 'nonProductionStorage', tds: ['name'], columns: ['Name'], items: [] },
                    noDescription: { label: 'No Description', name: 'noDescription', tds: ['name'], columns: ['Name'], items: [] }
                },
                showMessage: false,
                notification: [],
                currentReport: {
                    lastModified: '',
                    name: 'Choose a report…',
                    size: '',
                    type: ''
                }
            }

            Object.keys(data).forEach(key => {
                this[key] = data[key];
            });
        }
    }
});

isBlank = (value) => {
    return _.isEmpty(value) && !_.isNumber(value) || _.isNaN(value);
}

compareNames = (a, b) => {
    if(a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1;
    }

    if(a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1;
    }

    return 0;
}

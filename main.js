Vue.component('channel-table', {
    props: ['channel-group', 'columns', 'cells'],
    template:
    `<table class="table is-striped is-fullwidth is-hoverable">
        <thead>
            <tr class="has-background-grey-dark">
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
            <span v-if="cell == 'backgroundColor'" class="tag has-text-black" v-bind:style="{ backgroundColor: row[cell]}"></span>
            <span v-else>{{ row[cell] }}</span>
        </td>
    </tr>
    `
})

let app = new Vue({
    el: '#app',
    data: {
        columns: {
            noMetadataPruning: ['Name', 'Actual Name'],
            nonProductionStorage: ['Name', 'Actual Name'],
            noDescription: ['Name', 'Actual Name'],
            channelGroups: ['Name', 'Channels'],
            channelTags: ['Name', 'Color', 'Channel Count']
        },
        tds: {
            noMetadataPruning: ['prettyName', 'name'],
            nonProductionStorage: ['prettyName', 'name'],
            noDescription: ['prettyName', 'name'],
            channelGroups: ['name', 'channelCount'],
            channelTags: ['name', 'backgroundColor', 'channelCount']
        },
        serverSettings: {},
        channelTags: [],
        channelGroups: [],
        noMetadataPruning: [],
        nonProductionStorage: [],
        channels: [],
        noDescription: [],
        alerts: [],
        uploadError: false,
        errorMessage: '',
        currentReport: {
            lastModified: '',
            name: 'Choose a report…',
            size: '',
            type: ''
        },
        isLoaded: false,
        isLoading: false
    },
    mounted() {
        if(localStorage.getItem('currentReport')) {
            let localCurrentReport = JSON.parse(localStorage.getItem('currentReport'));
            
            this.currentReport.lastModified = localCurrentReport.lastModified;
            this.currentReport.name = localCurrentReport.name;
            this.currentReport.size = localCurrentReport.size;
            this.currentReport.type = localCurrentReport.type;
        }
        
        if(localStorage.getItem('serverSettings')) {
            this.serverSettings = JSON.parse(localStorage.getItem('serverSettings'));
        }
        
        if(localStorage.getItem('columns')) {
            this.columns = JSON.parse(localStorage.getItem('columns'));	
        }
        
        if(localStorage.getItem('channelGroups')) {
            this.channelGroups = JSON.parse(localStorage.getItem('channelGroups'));
        }
        
        if(localStorage.getItem('noMetadataPruning')) {
            this.noMetadataPruning = JSON.parse(localStorage.getItem('noMetadataPruning'));
        }
        
        if(localStorage.getItem('nonProductionStorage')) {
            this.nonProductionStorage = JSON.parse(localStorage.getItem('nonProductionStorage'));
        }
        
        if(localStorage.getItem('channels')) {
            this.channels = JSON.parse(localStorage.getItem('channels'));
        }
        
        if(localStorage.getItem('noDescription')) {
            this.noDescription = JSON.parse(localStorage.getItem('noDescription'));
        }
        
        if(localStorage.getItem('alerts')) {
            this.alerts = JSON.parse(localStorage.getItem('alerts'));
        }
    },
    methods: {
        onFileChange(e) {
            let files = e.target.files || e.dataTransfer.files;
            
            if(!files.length) {
                return;
            }

            if(files.length == 1) {
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
                
                if(type == 'application/json') {
                    this.loadJSONData(files[0]);
                } else if(type == 'text/xml') {
                    this.loadXMLData(files[0]);
                }
            }
        },
        loadXMLData(file) {
            let vm = this;

            let reader = new FileReader();

            reader.onloadstart = () => {
                vm.isLoading = true;
            }

            reader.onloadend = () => {
                vm.isLoading = false;
                vm.isLoaded = true;
            }

            reader.onload = (e) => {
                try {
                    let oParser = new DOMParser();
                    let oDom = oParser.parseFromString(e.target.result, "application/xml");
                    let config = this.getElements(oDom, 'serverConfiguration')[0];

                    let serverSettings = this.getElements(config, 'serverSettings')[0];
                    
                    vm.serverSettings = {
                        serverName: this.getElements(serverSettings, 'serverName')[0].innerHTML.toString(),
                        version: config.getAttribute('version').toString(),
                        queueBufferSize: this.getElements(serverSettings, 'queueBufferSize')[0].innerHTML.toString()
                    };

                    let alertsXML = this.getElements(this.getElements(config, 'alerts')[0], 'alertModel');
                    let alerts = [];

                    for(let alert of alertsXML) {
                        var alertObj = {
                            'id': this.getElements(alert, 'id')[0].innerHTML.toString(),
                            'name': this.getElements(alert, 'name')[0].innerHTML.toString(),
                            'enabled': this.getElements(alert, 'enabled')[0].innerHTML.toString()
                        };
                    
                        alerts.push(alertObj);
                    }

                    alerts.sort(compareNames);
                    vm.alerts = alerts;

                    let channelGroupsXML = this.getElements(this.getElements(config, 'channelGroups')[0], 'channelGroup');
                    let channelGroups = [];

                    for(let channelGroup of channelGroupsXML) {
                        var channelGroupObj = {
                            'id': this.getElements(channelGroup, 'id')[0].innerHTML.toString(),
                            'name': this.getElements(channelGroup, 'name')[0].innerHTML.toString(),
                            'channelCount': this.getElements(this.getElements(channelGroup, 'channels')[0], 'channel').length
                        };
                    
                        channelGroups.push(channelGroupObj);
                    }

                    channelGroups.sort(compareNames);
                    vm.channelGroups = channelGroups;
                    
                    let channelTagsXML = this.getElements(this.getElements(config, 'channelTags')[0], 'channelTag');
                    let channelTags = [];

                    for(let channelTag of channelTagsXML) {
                        let bgColor = this.getElements(channelTag, 'backgroundColor')[0];
                        let red = this.getElements(bgColor, 'red')[0].innerHTML.toString(); 
                        let green = this.getElements(bgColor, 'green')[0].innerHTML.toString();
                        let blue = this.getElements(bgColor, 'blue')[0].innerHTML.toString();
                        let alpha = this.getElements(bgColor, 'alpha')[0].innerHTML.toString();
                    
                        let channelTagObj = {
                            'id': this.getElements(channelTag, 'id')[0].innerHTML.toString(),
                            'name': this.getElements(channelTag, 'name')[0].innerHTML.toString(),
                            'channelCount': this.getElements(this.getElements(channelTag, 'channelIds')[0], 'string').length,
                            'backgroundColor': `rgb(${red},${green},${blue},${alpha})`
                        };
                    
                        channelTags.push(channelTagObj);
                    }

                    channelTags.sort(compareNames);
                    vm.channelTags = channelTags;

                    let allChannelsXML = this.getElements(config, 'channels');
                    let channelsXML;
                    let channels = [];
                    let nonProductionStorage = [];
                    let noMetadataPruning = [];
                    let noDescription = [];

                    for(let allChannel of allChannelsXML) {
                        if(allChannel.parentNode.localName.toString() == "serverConfiguration") {
                            channelsXML = this.getElements(allChannel, 'channel');
                        }
                    }

                    for(let channel of channelsXML) {
                        //this.getElements(channel, 'name');
                        let name = this.getElements(channel, 'name')[0].innerHTML.toString();
                        let properties;

                        for(let prop of this.getElements(channel, 'properties')) {
                            if(prop.parentNode.localName.toString() == "channel") {
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
                    
                        var channelObj = {
                            'id': this.getElements(channel, 'id')[0].innerHTML.toString(),
                            'name': name,
                            'prettyName': _.startCase(name),
                            'messageStorageMode': this.getElements(properties, 'messageStorageMode')[0].innerHTML.toString().toLowerCase(),
                            'developmentStorage': false, 
                            'hasPruning': false,
                            'pruneMetaData': pruneMetaData,
                            'pruneContent': pruneContentDays,
                            'hasDescription': false,
                            'description': description.substring(0, 25),
                            'isDanger': false,
                            'enabled': (this.getElements(metadata, 'enabled')[0].innerHTML.toString() == 'true')
                        };
                    
                        if(channelObj.messageStorageMode.indexOf('development') > -1) {
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

                    nonProductionStorage.sort(compareNames);
                    noDescription.sort(compareNames);
                    noMetadataPruning.sort(compareNames);
                    channels.sort(compareNames);

                    vm.channels = channels;
                    vm.nonProductionStorage = nonProductionStorage;
                    vm.noDescription = noDescription;
                    vm.noMetadataPruning = noMetadataPruning;

                    vm.uploadError = false;
                } catch(error) {
                    vm.setError('Malformed XML config', error);
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

                    vm.uploadError = false;
                    vm.isLoaded = true;
                    vm.persist();
                } catch(error) {
                    vm.setError('Malformed JSON report', error);
                }
            }

            reader.readAsText(file);
        },
        persist() {
            localStorage.setItem('currentReport', JSON.stringify(this.currentReport));
            localStorage.setItem('serverSettings', JSON.stringify(this.serverSettings));
            localStorage.setItem('channelTags', JSON.stringify(this.channelTags));
            localStorage.setItem('channelGroups', JSON.stringify(this.channelGroups));
            localStorage.setItem('noMetadataPruning', JSON.stringify(this.noMetadataPruning));
            localStorage.setItem('nonProductionStorage', JSON.stringify(this.nonProductionStorage));
            localStorage.setItem('channels', JSON.stringify(this.channels));
            localStorage.setItem('noDescription', JSON.stringify(this.noDescription));
            localStorage.setItem('alerts', JSON.stringify(this.alerts));
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
        setError(message, exception) {
            let errMessage = 'Error message not passed';

            if(!isBlank(message)) {
                errMessage = `<strong>${message}:</strong><br/>`;
            }

            if(!_.isNull(exception)) {
                errMessage = `${errMessage}Line: ${exception.lineNumber}<br/>${exception.toString()}`;
            }

            this.uploadError = true;
            this.isLoading = false;
            this.errorMessage = errMessage;
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
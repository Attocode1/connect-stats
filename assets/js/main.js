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

let config;
let channelsXML;

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
            let reader = new FileReader();
            let vm = this;

            reader.onloadstart = (e) => {
                vm.isLoading = true;
            }

            reader.onload = (e) => {
                try {
                    let oParser = new DOMParser();
                    oDom = oParser.parseFromString(e.target.result, "application/xml");
                    config = oDom.getElementsByTagName('serverConfiguration')[0];
                    
                    let serverSettings = config.getElementsByTagName('serverSettings')[0];
                    
                    vm.serverSettings = {
                        serverName: serverSettings.getElementsByTagName('serverName')[0].innerHTML.toString(),
                        version: config.getAttribute('version').toString(),
                        queueBufferSize: serverSettings.getElementsByTagName('queueBufferSize')[0].innerHTML.toString()
                    };

                    let alertsXML = config.getElementsByTagName('alerts')[0].getElementsByTagName('alertModel');
                    let alerts = [];

                    for(let alert of alertsXML) {
                        var alertObj = {
                            'id': alert.getElementsByTagName('id')[0].innerHTML.toString(),
                            'name': alert.getElementsByTagName('name')[0].innerHTML.toString(),
                            'enabled': alert.getElementsByTagName('enabled')[0].innerHTML.toString()
                        };
                    
                        alerts.push(alertObj);
                    }

                    alerts.sort(compareNames);
                    vm.alerts = alerts;

                    let channelGroupsXML = config.getElementsByTagName('channelGroups')[0].getElementsByTagName('channelGroup');
                    let channelGroups = [];

                    for(let channelGroup of channelGroupsXML) {
                        var channelGroupObj = {
                            'id': channelGroup.getElementsByTagName('id')[0].innerHTML.toString(),
                            'name': channelGroup.getElementsByTagName('name')[0].innerHTML.toString(),
                            'channelCount': channelGroup.getElementsByTagName('channels')[0].getElementsByTagName('channel').length
                        };
                    
                        channelGroups.push(channelGroupObj);
                    }

                    channelGroups.sort(compareNames);
                    vm.channelGroups = channelGroups;
                    
                    let channelTagsXML = config.getElementsByTagName('channelTags')[0].getElementsByTagName('channelTag');
                    let channelTags = [];

                    for(let channelTag of channelTagsXML) {
                        let bgColor = channelTag.getElementsByTagName('backgroundColor')[0];
                        let red = bgColor.getElementsByTagName('red')[0].innerHTML.toString(); 
                        let green = bgColor.getElementsByTagName('green')[0].innerHTML.toString();
                        let blue = bgColor.getElementsByTagName('blue')[0].innerHTML.toString();
                        let alpha = bgColor.getElementsByTagName('alpha')[0].innerHTML.toString();
                    
                        let channelTagObj = {
                            'id': channelTag.getElementsByTagName('id')[0].innerHTML.toString(),
                            'name': channelTag.getElementsByTagName('name')[0].innerHTML.toString(),
                            'channelCount': channelTag.getElementsByTagName('channelIds')[0].getElementsByTagName('string').length,
                            'backgroundColor': `rgb(${red},${green},${blue},${alpha})`
                        };
                    
                        channelTags.push(channelTagObj);
                    }

                    channelTags.sort(compareNames);
                    vm.channelTags = channelTags;

                    let allChannelsXML = config.getElementsByTagName('channels');
                    // let channelsXML;
                    let channels = [];
                    let nonProductionStorage = [];
                    let noMetadataPruning = [];
                    let noDescription = [];

                    for(let allChannel of allChannelsXML) {
                        if(allChannel.parentNode.localName.toString() == "serverConfiguration") {
                            channelsXML = allChannel.getElementsByTagName('channel');
                        }
                    }

                    for(let channel of channelsXML) {
                        let name = channel.getElementsByTagName('name')[0].innerHTML.toString();
                        let properties;

                        for(let prop of channel.getElementsByTagName('properties')) {
                            if(prop.parentNode.localName.toString() == "channel") {
                                properties = prop;
                            }
                        }

                        let metadata = channel.getElementsByTagName('exportData')[0].getElementsByTagName('metadata')[0];
                        let description = channel.getElementsByTagName('description')[0].innerHTML.toString();

                        let pruningSettings = metadata.getElementsByTagName('pruningSettings');
                        let pruneMetaData = '';
                        let pruneContentDays = '';

                        if(pruningSettings.length == 1) {
                            pruningSettings = pruningSettings[0];

                            pruneMetaData = pruningSettings.getElementsByTagName('pruneMetaDataDays');
                            if(pruneMetaData.length == 1) {
                                pruneMetaData = pruneMetaData[0].innerHTML.toString();
                            } else {
                                pruneMetaData = ''
                            }

                            pruneContentDays = pruningSettings.getElementsByTagName('pruneContentDays');
                            if(pruneContentDays.length == 1) {
                                pruneContentDays = pruneContentDays[0].innerHTML.toString();
                            } else {
                                pruneContentDays = ''
                            }
                        }
                    
                        var channelObj = {
                            'id': channel.getElementsByTagName('id')[0].innerHTML.toString(),
                            'name': name,
                            'prettyName': _.startCase(name),
                            'messageStorageMode': properties.getElementsByTagName('messageStorageMode')[0].innerHTML.toString().toLowerCase(),
                            'developmentStorage': false, 
                            'hasPruning': false,
                            'pruneMetaData': pruneMetaData,
                            'pruneContent': pruneContentDays,
                            'hasDescription': false,
                            'description': description.substring(0, 25),
                            'isDanger': false,
                            'enabled': (metadata.getElementsByTagName('enabled')[0].innerHTML.toString() == 'true')
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
                    vm.isLoaded = true;
                    vm.isLoading = false;
                } catch(error) {
                    vm.uploadError = true;
                    vm.isLoading = false;
                    vm.errorMessage = `<strong>Malformed XML config:</strong><br/>${error.toString()}`;
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
                    vm.uploadError = true;
                    vm.isLoading = false;
                    vm.errorMessage = `<strong>Malformed JSON report:</strong><br/>${error.toString()}`;
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
        }
    }
});

compareNames = (a, b) => {
    if(a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1;
    }

    if(a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1;
    }

    return 0;
}
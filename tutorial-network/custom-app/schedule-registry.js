const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;

let cardname = "admin@tutorial-network";
const onRejected = function(err) {
    console.error('Promise rejected', err);
    process.exit(1);
};
class ScheduleRegistry{

    constructor() {
        this.bizNetworkConnection = new BusinessNetworkConnection();
    }

    init() {
        return this.bizNetworkConnection.connect(cardname).then((businessNetworkDefinition) => {
            this.businessNetworkDefinition = businessNetworkDefinition;
            this.factory = businessNetworkDefinition.getFactory();
            return this.bizNetworkConnection.getAssetRegistry('org.example.biznet.Schedule');
        }, onRejected).then((scheduleRegistry) => {
            this.scheduleRegistry = scheduleRegistry;
            return Promise.resolve();
        }, onRejected);
    }

    addSchedule(scheduleId, userId, date, value) {
        console.log('Getting schedule registry.');
        return this.scheduleRegistry.exists(scheduleId).then((exist) => {
            if (exist) {
                console.log("Schedule already exists.");
                return Promise.reject("Err: Schedule already exists.");
            } else {
                let schedule = this.factory.newResource('org.example.biznet','Schedule',scheduleId);
                schedule.user = this.factory.newRelationship('org.example.biznet','User',userId);
                schedule.value = value;
                schedule.diffrenceWithPreviousSchedule = Number.MAX_VALUE;
                schedule.date = date;
                schedule.s_endOfDay = 0;
                return this.scheduleRegistry.add(schedule);
            }
        });
    }


    removeSchedule(scheduleId) {
        console.log('Getting schedule registry.');
        return this.scheduleRegistry.exists(scheduleId).then((exist) => {
            if (exist) {
                return this.scheduleRegistry.remove(scheduleId)
            } else {
                console.log("Schedule does not exist.");
                return Promise.reject("Err: "+scheduleId+" does not exist.");
            }
        }, onRejected);
    }

    removeAllSchedules() {
        console.log('Getting schedule registry.');
        return this.scheduleRegistry.getAll().then((resources) => {
            return this.scheduleRegistry.removeAll(resources);
        }, onRejected);
    }

    async getScheduleTable() {

        let resources = await this.scheduleRegistry.resolveAll();
        let addAssetTrReg = await this.bizNetworkConnection.getTransactionRegistry("org.hyperledger.composer.system.AddAsset");
        let addAssetTrs = await addAssetTrReg.resolveAll();
        let schedUpdateTrReg = await this.bizNetworkConnection.getTransactionRegistry("org.example.biznet.ScheduleUpdate");
        let schedUpdateTrs = await schedUpdateTrReg.resolveAll();

        let table = {
            data: [],
            addAsset: addAssetTrs,
            updateAsset: schedUpdateTrs
        };

        for (let res of resources) {
            let sched = {};
            sched.id = res.scheduleId;
            sched.userId = res.user.userId;
            sched.date = res.date;
            sched.value = res.value;
            sched.s_endOfDay = res.s_endOfDay;
            sched.diffrenceWithPreviousSchedule = res.diffrenceWithPreviousSchedule;
            table.data.push(sched);
        }
        return Promise.resolve(table);
    }

    updateSchedule(scheduleId, value, s) {
        console.log('Getting serializer.');
        let serializer = this.businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            '$class': 'org.example.biznet.ScheduleUpdate',
            'schedule': scheduleId,
            'newValue': value,
            's_endOfDay': s,
        });

        return this.bizNetworkConnection.submitTransaction(resource);
    }

    getAllTransactions() {
        return this.bizNetworkConnection.getHistorian()
            .then((historian)=>{
                return historian.resolveAll();
            }, onRejected)
            .then((table)=>{
                let trTypes = table.map((tr)=>tr.transactionType);
                trTypes = trTypes.filter( (trType, index, self) => index === self.indexOf(trType));
                return Promise.all(trTypes.map((trType) => {
                    return this.bizNetworkConnection.getTransactionRegistry(trType).then((registry)=>{
                        return registry.resolveAll().then((transctions)=>{
                            return Promise.resolve(transctions.map((tr)=>{
                                return {type: trType, data: tr};
                            }));
                        }, onRejected);
                    })
                }));
            }, onRejected)
            .then((trArrays)=>{
                let allTransactions = [].concat.apply([], trArrays);
                allTransactions = allTransactions.sort((a,b)=>a.data.timestamp<b.data.timestamp);
                return Promise.resolve(allTransactions);
            }, onRejected);
    }
}

module.exports = ScheduleRegistry;

import localforage from "localforage"
import { isNodeServer } from "src/ts/platform"
import { NodeStorage } from "./nodeStorage"
import { OpfsStorage } from "./opfsStorage"
import { alertStore } from "../alert"

export class AutoStorage{
    isAccount:boolean = false

    realStorage:LocalForage|NodeStorage|OpfsStorage

    async setItem(key:string, value:Uint8Array):Promise<string|null> {
        await this.Init()
        await this.realStorage.setItem(key, value)
        return null
    }
    async getItem(key:string):Promise<Buffer> {
        await this.Init()
        return await this.realStorage.getItem(key)

    }
    async keys():Promise<string[]>{
        await this.Init()
        return await this.realStorage.keys()

    }
    async removeItem(key:string){
        await this.Init()
        return await this.realStorage.removeItem(key)
    }

    async Init(){
        if(!this.realStorage){
            if(isNodeServer){
                console.log("using node storage")
                this.realStorage = new NodeStorage()
                return
            }
            else if(window.navigator?.storage?.getDirectory &&
                    FileSystemFileHandle?.prototype?.createWritable &&
                    localStorage.getItem('opfs_flag!') === "able"){
                console.log("using opfs storage")

                const forage = localforage.createInstance({
                    name: "risuai"
                })

                const legacyDatabase = await forage.getItem<Uint8Array>("database/database.bin")
                const opfs = new OpfsStorage()

                if((!legacyDatabase) || (await forage.getItem("migrated"))){
                    this.realStorage = opfs
                    return
                }
                else if(!(await forage.getItem("denied_opfs"))){
                    const opfsDatabase = await opfs.getItem('database/database.bin')
                    if (opfsDatabase) {
                        // A matching database may be the first file of an interrupted migration.
                        // Keep the intact source active unless every source file was copied.
                        if (Buffer.from(opfsDatabase).equals(Buffer.from(legacyDatabase))) {
                            for (const key of await forage.keys()) {
                                const source = await forage.getItem<Uint8Array>(key)
                                const copied = await opfs.getItem(key)
                                if (!(source instanceof Uint8Array) || !copied || !Buffer.from(copied).equals(Buffer.from(source))) {
                                    this.realStorage = forage
                                    return
                                }
                            }
                            await forage.setItem('migrated', true)
                        }
                        this.realStorage = opfs
                        return
                    }
                    if ((await opfs.keys()).length > 0) {
                        this.realStorage = forage
                        return
                    }
                    console.log("migrating")
                    const keys = await forage.keys()
                    let i = 0;
                    for(const key of keys){
                        alertStore.set({
                            type: "wait",
                            msg: `Migrating your data...(${i}/${keys.length})`
                        })
                        await opfs.setItem(key,await forage.getItem(key))
                        i += 1
                    }
                    await forage.setItem("migrated", true)
                    this.realStorage = opfs
                    alertStore.set({
                        type: "none",
                        msg: ""
                    })
                    return
                }
            }
            console.log("using forage storage")
            this.realStorage = localforage.createInstance({
                name: "risuai"
            })
        }
    }

    listItem = this.keys
}

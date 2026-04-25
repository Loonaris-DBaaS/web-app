import ConnectionParameters from "../components/ui/ConnectionParameters";
import DashboardHeader from "../components/ui/DashboardHeader";
import { InstanceContainer } from "../components/ui/InstanceContainer";
import CreateDatabaseForm from "../components/ui/CreateDatabaseForm";
export default function Test(){
    return (
    <>
        <DashboardHeader pageTitle="Test" pageDescription="This is a test page" />
        <ConnectionParameters
            connectionString="postgres://root:••••••••••••@db.loonaris.io:5432/production_main"
            mode="Standard"
            modes={['Standard', 'URI', 'JDBC']}
            onModeChange={(m) => console.log(m)}
        />
        <InstanceContainer name="Production Main" version="PostgreSQL 15.3" region="us-east-1" usedStorage={20} totalStorage={100} status="RUNNING" />
        <CreateDatabaseForm onSubmit={(data) => console.log(data)} onCancel={()=>console.log("cancelled")} />
        </>

    )
}
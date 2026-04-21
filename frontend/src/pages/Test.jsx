import ConnectionParameters from "../components/ui/ConnectionParameters";
import DashboardHeader from "../components/ui/DashboardHeader";
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
        </>
    )
}
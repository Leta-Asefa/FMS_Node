import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Platform, Image } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>

        <View style={{display:"flex",flex: 1,  flexDirection:"row" }}>
          <View style={{flex:1,backgroundColor:"#000000"}}></View>
          <View style={{flex:1,backgroundColor:"#f32f00"}}></View>
          <View style={{flex:1,backgroundColor:"#ff0000"}}></View>
        </View>
        <View style={{display:"flex", flex: 1, backgroundColor: "aqua" }}>
          <View style={{flex:1,backgroundColor:"skyblue"}}></View>
          <View style={{display:"flex", flex:1}}>
              <View style={{flex:1,backgroundColor:"#f522ff"}}></View>
              <View style={{flex:2,backgroundColor:"#000000"}}></View>
              <View style={{flex:1,backgroundColor:"#f4366f"}}></View>
          </View>
          <View style={{flex:1,backgroundColor:"skyblue"}}></View>
        </View>
        <View style={{display:"flex",flex:1,flexDirection:"row"}}>
        <View style={{flex:1,backgroundColor:"#ff5600"}}></View>
          <View style={{flex:1,backgroundColor:"#ffff00"}}></View>
          <View style={{flex:1,backgroundColor:"#054300"}}></View>
        </View>
      <StatusBar
        backgroundColor="#000000"
        style="light"
        animated={true}
        hidden={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display:"flex",
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#ffff00",
   
  }

});
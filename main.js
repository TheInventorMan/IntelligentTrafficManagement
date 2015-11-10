/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */

/*
A simple node.js application intended to read data from Digital pins on the Intel based development boards such as the Intel(R) Galileo and Edison with Arduino breakout board.

MRAA - Low Level Skeleton Library for Communication on GNU/Linux platforms
Library in C/C++ to interface with Galileo & other Intel platforms, in a structured and sane API with port nanmes/numbering that match boards & with bindings to javascript & python.

Steps for installing MRAA & UPM Library on Intel IoT Platform with IoTDevKit Linux* image
Using a ssh client: 
1. echo "src maa-upm http://iotdk.intel.com/repos/1.1/intelgalactic" > /etc/opkg/intel-iotdk.conf
2. opkg update
3. opkg upgrade

Article: https://software.intel.com/en-us/html5/articles/intel-xdk-iot-edition-nodejs-templates
*/
import mraa;
import Math;

//Port Initialization

var GPS = mraa.Uart(0);
var 3G = mraa.Usb(0);   //not working as of yet, a USB host port driver will be implemented in its place
var increase = mraa.gpio(2);
var maintain = mraa.gpio(3);
var decrease = mraa.gpio(4);
GPS.setBaudRate(9600);	

//Constants

var earthRadius = 6371000; //radius of the Earth in meters
var degToRad = 0.01745329251; //Radians per degree
var radToDeg = 57.2957795131; //Degrees per radian


function getLocation(){                  //Uses the $GPGGA messages to determine current location
	var GPSLocation = [0,0,0,0];
	while(1){
		if(GPS.dataAvailable()){
			var buffer = GPS.readStr(512);
			if (buffer.find("GPGGA") != -1){
				var rawNmea = buffer.substring(buffer.search("GPGGA"), buffer.search("\n"));
				var nmeaList = rawNmea.strip().split(",");
                var time = nmeaList[1];
				var latraw = nmeaList[2];
				var latdir = nmeaList[3];
				var lonraw = nmeaList[4];
				var londir = nmeaList[5];
				var lat = (latraw.substring(0,2)) + (latraw.substring(2)) /60;
				var lon = (lonraw.substring(0,3)) + (lonraw.substring(3,0)) /60;
				if (londir == "W"){
					lon = lon * -1;
                }
                if (latdir == "S"){
                    lat = lat * -1;
                }
				var alt = nmeaList[9];
				GPSLocation = [lat,lon,alt,time];
				return GPSLocation;
            }
        }
    }
}
                
function getVelocity(){	               //Uses $GPVTG messages to determine speed and direction
	var GPSVel = [0,0];
	while(1){
		if(GPS.dataAvailable()){
			var buffer = GPS.readStr(512);
			if (buffer.find("GPVTG") != -1){
				var nmeaData = buffer.substring(buffer.search("GPVTG"), buffer.search("\n"));
				var nmeaList = nmeaData.strip().split(",");
				var hdg = nmeaList[1];
                var rawVel = nmeaList[7];
                var vel = rawVel / 3.6;
				GPSVel = [hdg,vel];
				return GPSVel;
            }
        }
    }
}

function getLights(){
    var Lights = [7][10];  //array of traffic light timings, 10 nearest lights, 7 parameters each. Lat,Lon,NTime,Etime,TimeOffset,Heading,Distance
    //requestData();
    if(3G.dataAvailable()){
			var buffer = 3G.readStr(512);
			if (buffer.find("$$") != -1){
                lightData = buffer.substring(buffer.search("$$"), buffer.search("\n"));   //light information specification follows GPS scheme, with "$$" denoting the beginning of a sentence.
                lightList = nmeaData.strip().split(",");
                
                for (i=0;i<lightList.length(); i++){   //parses data into Lights database, preventing index overflows in the process
                    var rowCtr = 0;
                    var arrayIdx = i - (rowCtr*7);
                    Lights[arrayIdx][rowCtr] = lightList[i];
                    if (i == 4){
                        rowCtr++;
                    }
                }
                return Lights;
                
            }
    }
    
    
}

function computeDistance(Latdeg1, Londeg1, Latdeg2, Londeg2){
    var Lat1 = Latdeg1 * degToRad;
    var Lat2 = Latdeg2 * degToRad;
    var Lon1 = Londeg1 * degToRad;
    var Lon2 = Londeg2 * degToRad;
    var distance = 2*earthRadius* Math.asin(sqrt((Math.sin(Lat2-Lat1/2))^2 + (Math.cos(Lat1) * Math.cos(Lat2) * (Math.sin(Lon2-Lon1/2))^2) )); //Use haversine formula to compute great circle distance
    
}

function computeHeading(Latdeg1, Londeg1, Latdeg2, Londeg2){
    var Lat1 = Latdeg1 * degToRad;
    var Lat2 = Latdeg2 * degToRad;
    var Lon1 = Londeg1 * degToRad;
    var Lon2 = Londeg2 * degToRad;
    var y = Math.sin(Lon2-Lon1) * Math.cos(Lat2);
    var x = Math.cos(Lat1)*Math.sin(Lat2) - Math.sin(Lat1)*Math.cos(Lat2)*Math.cos(Lon2-Lon1);
    var heading = Math.atan2(y, x).toDegrees();
    return heading;
}




//Main Sequence
while(1){
    var temp[4];
    var currLat;
    var currLon;
    var currHdg;
    var currSpd;
    var Lights;
    var time;
    var Dir;
    var currSignal;
    var t1, t2;
    
    temp = getLocation();
    currLat = temp[0];
    currLon = temp[1];
    time = temp[3];
    
    temp = getVelocity();
    currHdg = temp[0];
    currSpd = temp[1];
    
    Lights = getLights();
    
    for(i = 0; i < Lights.length(); i++){
        
        var hdg = computeHeading(currLat, currLon, Lights[0][i], Lights[1][i]);
        
        if (hdg > 180)
        {
        Lights[5][i] = 180 - computeHeading(currLat, currLon, Lights[0][i], Lights[1][i]);
        }
        else
        {
        Lights[5][i] = computeHeading(currLat, currLon, Lights[0][i], Lights[1][i]);
        }
        
        Lights[6][i] = computeDistance(currLat, currLon, Lights[0][i], Lights[1][i]);
        
        if (Lights[6][i] < Lights[6][currSignal]){
        currSignal = i;
        }
        
    }
    
    if (hdg < 45 || hdg > 315 || 135 < hdg < 225){ //north-south traffic
        Dir = 0;
    } else {
        Dir = 1;
    }
    
    if (Dir == 0){
     t1 = Lights[4][currSignal] + time%(Lights[2][currSignal] + Lights[3][currSignal]);   //may need to be fixed   
     t2 = Lights[4][currSignal] + time%(Lights[2][currSignal] + Lights[3][currSignal]) + Lights[2][currSignal];   
    }else{
     t1 = Lights[4][currSignal] + time%(Lights[2][currSignal] + Lights[3][currSignal]);
     t2 = Lights[4][currSignal] + time%(Lights[2][currSignal] + Lights[3][currSignal]) + Lights[3][currSignal];
    }
    
    if (t1 > Lights[6][currSignal]){
        \\increase speed
        increase.write(1);
        maintain.write(0);
        decrease.write(0);
    } else if(t1 == Lights[6][currSignal]){
        \\maintain speed
        increase.write(0);
        maintain.write(1);
        decrease.write(0);
    } else {
       \\decrease speed   
       increase.write(0);
       maintain.write(0);
       decrease.write(1);
    }

}
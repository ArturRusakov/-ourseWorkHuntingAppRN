import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import Button from './src/components/Button';
import { StyleSheet, Text, View, Image } from 'react-native';

import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite/legacy';
import { Asset } from 'expo-asset';

import * as Location from 'expo-location';
import { Camera, CameraType } from 'expo-camera/legacy';
import * as MediaLibrary from 'expo-media-library';

import NetInfo from '@react-native-community/netinfo';

import axios from 'axios';

const db = SQLite.openDatabase('hunting.db', '2.0');
const createTable = () => {
  db.transaction(tx => {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS hunting (id INTEGER PRIMARY KEY AUTOINCREMENT, photo TEXT, latitude TEXT, longitude TEXT, preyData TEXT,preyTime TEXT);',
      [],
      () => console.log('Таблица создана успешно'),
      (_, error) => console.error('Ошибка при создании таблицы: ' + error)
    );
  });

};
const addData = (photo, latitude, longitude, prey_data, prey_time) => {
  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO hunting (photo, latitude, longitude, preyData, preyTime) VALUES (?, ?, ?, ?, ?);',
      [photo, latitude, longitude, prey_data, prey_time],
      (_, result) => console.log('Данные успешно добавлены'),
      (_, error) => console.error('Ошибка при добавлении данных: ' + error)
    );
  });
};
const displayData = () => {
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM hunting;',
      [],
      (_, { rows }) => {
        console.log('Данные из таблицы:');
        for (let i = 0; i < rows.length; i++) {
          console.log(rows.item(i));
        }
      },
      (_, error) => console.error('Ошибка при выводе данных: ' + error)
    );
  });
};
const clearData = () => {
  db.transaction(tx => {
    tx.executeSql(
      'DELETE FROM hunting;',
      [],
      () => console.log('Данные успешно удалены'),
      (_, error) => console.error('Ошибка при очистке данных: ' + error)
    );
  });
};
const deleteItem = async (id) => {

  // Удалить поле из таблицы
  const sql = "DELETE FROM hunting WHERE id = ?";
  db.transaction(tx => {
    tx.executeSql(sql, [id]);
  });
};

const preyData = () => {
  const Data = new Date();
  const Year = Data.getFullYear();
  const Month = Data.getMonth();
  const Day = Data.getDate();
  const Hour = Data.getHours();
  const Minutes = Data.getMinutes();
  const Seconds = Data.getSeconds();

  const yearMounthDay = Year + '-' + Month + '-' + Day;
  const hourMin = Hour + ':' + Minutes + ':' + Seconds;
  return { yearMounthDay, hourMin }
}

const callNodeFunction = async (photo, latitude, longtitude, prey_date, prey_time) => {
  try {
    const response = await axios.get('http://192.168.0.110:3000/api/sendData', {
      params: {
        photo, latitude, longtitude, prey_date, prey_time
      },
    });
    console.log(response.data.message);
  } catch (error) {
    console.log("App.js ->", error);
  }
};


export default function App() {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [image, setImage] = useState(null);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [flash, setFlash] = useState(Camera.Constants.FlashMode.off);
  const cameraRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  var [imageBase64, setImageBase64] = useState(null);

  const [netInfo, setNetInfo] = useState('');

  useEffect(() => {
    (async () => {
      MediaLibrary.requestPermissionsAsync();
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === 'granted');
    })();
  }, []);

  useEffect(() => {
    (async () => {

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Соглашение на отправку сообщения отклонено!');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      createTable();
      //clearData();
    })();
  }, []);


  useEffect(() => {
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {

        const sql = "SELECT * FROM hunting";
        db.transaction(tx => {
          tx.executeSql(sql, [], (tx, results) => {
            const data = results.rows._array.map(row => ({
              id: row.id,
              photo: row.photo,
              latitude: row.latitude,
              longitude: row.longitude,
              preyData: row.preyData,
              preyTime: row.preyTime,
            }));
            console.log("isConnected ->", state.isConnected);
            for (let i = 0; i < data.length; i++) {
              callNodeFunction(data[i].photo, data[i].latitude, data[i].longitude, data[i].preyData, data[i].preyTime).then(() => { deleteItem(data[i].id) })
            }
          });
        });
      } else {
        console.log("App.js -> Отсутсвует подключение к интернету");
      }
    })
  }, []);

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const data = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        setImageBase64(imageBase64 = data.base64);
        setImage(data.uri);
      } catch (e) {
        console.log(e);
      }
    }
  }

  const saveImage = async () => {
    if (image) {
      try {
        await MediaLibrary.createAssetAsync(image);
        alert('Фото сохранено ✅');
        setImage(null);
      } catch (e) {
        console.log(e);
      }
    }
  }

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    alert("Геолокация фото сохранена")
    console.log(location);
    return location;
  }

  const handlePressSaveButton = async () => {
    let location = await getCurrentLocation();
    await saveImage();
    var photo = imageBase64
    addData(photo, location["coords"]["latitude"], location["coords"]["longitude"], preyData().yearMounthDay, preyData().hourMin)
    return;
  };

  const handlePressReturnButton = async () => {
    setImage(null);
    displayData();
    return;
  };

  if (hasCameraPermission === false) {
    return <Text>No access to camera</Text>
  }

  return (
    <View style={styles.container}>
      {!image ?
        <Camera
          style={styles.camera}
          type={type}
          flashMode={flash}
          ref={cameraRef}
        >
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 40,
          }}>
            <Button icon={'flash'}
              color={flash === Camera.Constants.FlashMode.off ? 'gray' : '#f1f1f1'}
              onPress={() => {
                setFlash(flash === Camera.Constants.FlashMode.off ? Camera.Constants.FlashMode.on : Camera.Constants.FlashMode.off);
              }} />
            <Button icon={'retweet'} onPress={() => {
              setType(type === CameraType.back ? CameraType.front : CameraType.back);
            }} />
          </View>
        </Camera>
        :
        <Image source={{ uri: image }} style={styles.camera} />
      }
      <View>
        {image ?
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 50
          }}>
            <Button title={"Переделать фото"} icon="retweet" onPress={/*() => setImage(null)*/ handlePressReturnButton} />
            <Button title={"Сохранить"} icon="check" onPress={handlePressSaveButton} />
          </View>
          :
          <Button title={'Сделать фото'} icon="camera" onPress={takePicture} />
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    paddingBottom: 30
  },
  camera: {
    flex: 1,
    borderRadius: 20,
  }
});

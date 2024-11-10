import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import Button from './src/components/Button';
import { StyleSheet, Text, View, Image } from 'react-native';

import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';

import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

import NetInfo from '@react-native-community/netinfo';

import axios from 'axios';

const db = SQLite.openDatabase('hunting.db');
const createTable = () => {
  db.transaction(tx => {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS hunting (id INTEGER PRIMARY KEY AUTOINCREMENT, photo TEXT, latitude TEXT, longitude TEXT, preyData TEXT, preyTime TEXT);',
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
  db.transaction(tx => {
    tx.executeSql('DELETE FROM hunting WHERE id = ?', [id]);
  });
};

const preyData = () => {
  const Data = new Date();
  const Year = Data.getFullYear();
  const Month = Data.getMonth() + 1;
  const Day = Data.getDate();
  const Hour = Data.getHours();
  const Minutes = Data.getMinutes();
  const Seconds = Data.getSeconds();

  const yearMounthDay = `${Year}-${Month}-${Day}`;
  const hourMin = `${Hour}:${Minutes}:${Seconds}`;
  return { yearMounthDay, hourMin };
};

const callNodeFunction = async (photo, latitude, longitude, prey_date, prey_time) => {
  try {
    const response = await axios.get('http://192.168.0.110:3000/api/sendData', {
      params: {
        photo, latitude, longitude, prey_date, prey_time
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

  const [imageBase64, setImageBase64] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus.status === 'granted');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      } else {
        setErrorMsg('Соглашение на отправку сообщения отклонено!');
      }
    })();
  }, []);

  useEffect(() => {
    createTable();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        db.transaction(tx => {
          tx.executeSql('SELECT * FROM hunting', [], (_, results) => {
            const data = results.rows._array.map(row => ({
              id: row.id,
              photo: row.photo,
              latitude: row.latitude,
              longitude: row.longitude,
              preyData: row.preyData,
              preyTime: row.preyTime,
            }));
            data.forEach(async item => {
              await callNodeFunction(item.photo, item.latitude, item.longitude, item.preyData, item.preyTime);
              deleteItem(item.id);
            });
          });
        });
      } else {
        console.log("App.js -> Отсутсвует подключение к интернету");
      }
    });
    return () => unsubscribe();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        setImageBase64(data.base64);
        setImage(data.uri);
      } catch (e) {
        console.log(e);
      }
    }
  };

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
  };

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      alert("Геолокация фото сохранена");
      return location;
    }
  };

  const handlePressSaveButton = async () => {
    const currentLocation = await getCurrentLocation();
    if (currentLocation) {
      await saveImage();
      addData(
        imageBase64,
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        preyData().yearMounthDay,
        preyData().hourMin
      );
    }
  };

  const handlePressReturnButton = async () => {
    setImage(null);
    displayData();
  };

  if (hasCameraPermission === false) {
    return <Text>No access to camera</Text>;
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
              onPress={() => setFlash(
                flash === Camera.Constants.FlashMode.off
                  ? Camera.Constants.FlashMode.on
                  : Camera.Constants.FlashMode.off
              )}
            />
            <Button icon={'retweet'} onPress={() => {
              setType(type === Camera.Constants.Type.back ? Camera.Constants.Type.front : Camera.Constants.Type.back);
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
            <Button title={"Переделать фото"} icon="retweet" onPress={handlePressReturnButton} />
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

# !/bin/bash

pushd .

SIA_CLUSTER_VERSION="v0-9-2"
SIA_RELEASE_PATH="sia-cluster-$SIA_CLUSTER_VERSION"
NODE_VERSION="4.4.7"
MONGO_PATH="/c/Program Files/MongoDB/Server/3.0"
MINGW_PATH="/c/Program Files/Git/mingw64"
NODE_PATH="/c/Program Files/nodejs"
cd ../../../..
mkdir releases
cd releases
rm -rf $SIA_RELEASE_PATH


mkdir $SIA_RELEASE_PATH
cp -r ../sia-cluster/* $SIA_RELEASE_PATH/

#git clone https://github.com/aspectron/sia-cluster $SIA_RELEASE_PATH

cd $SIA_RELEASE_PATH
# npm install

mkdir bin
cd bin

mkdir mongo
cp -r  "$MONGO_PATH/bin/mongod.exe" mongo/
cp -r  "$MONGO_PATH/bin/mongo.exe" mongo/
cp -r  "$MONGO_PATH/bin/mongodump.exe" mongo/
cp -r  "$MONGO_PATH/bin/libeay32.dll" mongo/
cp -r  "$MONGO_PATH/bin/ssleay32.dll" mongo/

mkdir mingw64
cp -r  "$MINGW_PATH/bin/curl.exe" mingw64/
cp -r  "$MINGW_PATH/bin/libcurl-4.dll" mingw64/

mkdir node
cp -r  "$NODE_PATH/node.exe" node/

cd ..
mkdir data
cd data
mkdir db
cd db
touch .db
cd ../../bin

echo -e "@echo off\ncd ..\nbin\\\\node\\\\node tools/release/win64/init.js %1\ncd bin\npause\n" > init.bat

cd ../..

/c/Program\ Files/WinRAR/WinRAR a -r -afzip sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*

popd



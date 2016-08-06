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

echo "Cleaning up..."
rm -rf $SIA_RELEASE_PATH

echo "Cloning..."

if test "$1" == "--local"; then
	echo "Packaging LOCAL copy"
	mkdir $SIA_RELEASE_PATH
	cp -r ../sia-cluster/* $SIA_RELEASE_PATH/
	cd $SIA_RELEASE_PATH
elif test "$1" == "--dev"; then
	echo "Packaging DEV branch"
	git clone https://github.com/aspectron/sia-cluster $SIA_RELEASE_PATH
	cd $SIA_RELEASE_PATH
	git checkout -b dev
	git branch --set-upstream-to=origin/dev dev
	git pull
	npm install
else
	echo "Packaging MASTER branch"
	git clone https://github.com/aspectron/sia-cluster $SIA_RELEASE_PATH
	cd $SIA_RELEASE_PATH
	npm install
fi

# we are in $SIA_RELEASE_PATH

echo "Binaries..."

mkdir bin
cd bin

mkdir mongo
cp -r  "$MONGO_PATH/bin/mongod.exe" mongo/
cp -r  "$MONGO_PATH/bin/mongo.exe" mongo/
cp -r  "$MONGO_PATH/bin/mongodump.exe" mongo/
cp -r  "$MONGO_PATH/bin/libeay32.dll" mongo/
cp -r  "$MONGO_PATH/bin/ssleay32.dll" mongo/

#mkdir mingw64
#cp -r  "$MINGW_PATH/bin/curl.exe" mingw64/
#cp -r  "$MINGW_PATH/bin/libcurl-4.dll" mingw64/

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

cd ..
rm bash.exe.stackdump
cd ..

echo "Packaging..."
#/c/Program\ Files/WinRAR/WinRAR a -r sia-cluster-$SIA_CLUSTER_VERSION.rar $SIA_RELEASE_PATH/*
#/c/Program\ Files/WinRAR/WinRAR a -r -afzip sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
#/c/Program\ Files/Git/mingw64/zip -r sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
zip -q -r sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*


echo "Done."

popd



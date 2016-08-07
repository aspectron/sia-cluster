# !/bin/bash

pushd .

SIA_CLUSTER_VERSION="v0-9-2"
SIA_RELEASE_PATH="sia-cluster-$SIA_CLUSTER_VERSION"
MINGW_PATH="/c/Program Files/Git/mingw64"
NODE_PATH="/c/Program Files/nodejs"

if [[ "$1" =~ ^(--local|--dev|--master)$ ]]; then
	echo "Starting Win64 build"
else
	echo "Please use one of the following: --local --dev --master"
	exit
fi

cd ../../../..
mkdir -p releases
cd releases

echo "Cleaning up..."
rm -rf $SIA_RELEASE_PATH

echo "Cloning..."

if [[ $* == *--local* ]]; then
	echo "Packaging LOCAL copy"
	mkdir $SIA_RELEASE_PATH
	cp -r ../sia-cluster/* $SIA_RELEASE_PATH/
	cd $SIA_RELEASE_PATH
	flatten-packages
elif [[ $* == *--dev* ]]; then
	echo "Packaging DEV branch"
	git clone https://github.com/aspectron/sia-cluster $SIA_RELEASE_PATH
	if (($? != 0)); then echo "GIT CLONE Error" && exit 1; fi
	cd $SIA_RELEASE_PATH
	git checkout -b dev
	if (($? != 0)); then echo "GIT CHECKOUT Error" && exit 1; fi
	git branch --set-upstream-to=origin/dev dev
	sleep 3
	git pull
	if (($? != 0)); then echo "GIT PULL Error" && exit 1; fi
	npm install
	if (($? != 0)); then echo "NPM Error" && exit 1; fi
	flatten-packages
elif [[ $* == *--master* ]]; then
	echo "Packaging MASTER branch"
	git clone https://github.com/aspectron/sia-cluster $SIA_RELEASE_PATH
	if (($? != 0)); then echo "GIT CLONE Error" && exit 1; fi
	cd $SIA_RELEASE_PATH
	npm install
	if (($? != 0)); then echo "NPM Error" && exit 1; fi
	flatten-packages
fi

# we are in $SIA_RELEASE_PATH

echo "Binaries..."

mkdir -p bin
cd bin

#mkdir mingw64
#cp -r  "$MINGW_PATH/bin/curl.exe" mingw64/
#cp -r  "$MINGW_PATH/bin/libcurl-4.dll" mingw64/

mkdir node
cp -r  "$NODE_PATH/node.exe" node/

cd ..
mkdir -p data/db
touch data/db/.db
cd bin

echo -e "@echo off\ncd ..\nbin\\\\node\\\\node tools/release/win64/setup.js %1\ncd bin\npause\n" > setup.bat

cd ../..

if [[ ! $* == *--nopack* ]]; then
	echo "Packaging..."
	#/c/Program\ Files/WinRAR/WinRAR a -r sia-cluster-$SIA_CLUSTER_VERSION.rar $SIA_RELEASE_PATH/*
	#/c/Program\ Files/WinRAR/WinRAR a -r -afzip sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
	#/c/Program\ Files/Git/mingw64/zip -r sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
	rm sia-cluster-$SIA_CLUSTER_VERSION.zip
	zip -q -9 -r sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
fi

echo "Done."

popd



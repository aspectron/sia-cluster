# !/bin/bash

pushd .

SIA_CLUSTER_VERSION="v0-9-2"
SIA_CLUSTER_RELEASE_PATH="sia-cluster-$SIA_CLUSTER_VERSION"
SIA_NODE_RELEASE_PATH="sia-node-$SIA_CLUSTER_VERSION"


cd ../../../..
mkdir -p releases
cd releases

if [[ ! $* == *--nobuild* ]]; then
	cd ../sia-cluster/tools/release/win64
	bash build-win64.sh $1 --nopack
	cd ../../../../sia-node/tools/release/win64
	bash build-win64.sh $1 --nopack
	cd ../../../..
fi

if [ ! -d SIA_CLUSTER_RELEASE_PATH]; then exit; fi
if [ ! -d SIA_NODE_RELEASE_PATH]; then exit; fi

echo "Packaging Bundle..."
#/c/Program\ Files/WinRAR/WinRAR a -r sia-cluster-$SIA_CLUSTER_VERSION.rar $SIA_RELEASE_PATH/*
#/c/Program\ Files/WinRAR/WinRAR a -r -afzip sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
#/c/Program\ Files/Git/mingw64/zip -r sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
echo "zip -q -9 -r xx-sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_CLUSTER_RELEASE_PATH/* -i $SIA_NODE_RELEASE_PATH/*"

zip -q -9 -r sia-cluster-bundle-$SIA_CLUSTER_VERSION.zip $SIA_CLUSTER_RELEASE_PATH $SIA_NODE_RELEASE_PATH


echo "Done."

popd



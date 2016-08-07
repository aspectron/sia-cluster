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
	bash build.sh $1
	if (($? != 0)); then echo "Sia Cluster Build Error" && exit 1; fi
	cd ../../../../sia-node/tools/release/win64
	bash build.sh $1
	if (($? != 0)); then echo "Sia Node Build Error" && exit 1; fi
	cd ../../../../releases
fi

if [[ ! -d "$SIA_CLUSTER_RELEASE_PATH" ]]; then
	echo "Bundle error: Unable to locate $SIA_CLUSTER_RELEASE_PATH"
	exit
fi
if [[ ! -d "$SIA_NODE_RELEASE_PATH" ]]; then 
	echo "Bundle error: Unable to locate $SIA_NODE_RELEASE_PATH"
	exit 
fi

echo "Packaging Bundle..."
#/c/Program\ Files/WinRAR/WinRAR a -r sia-cluster-$SIA_CLUSTER_VERSION.rar $SIA_RELEASE_PATH/*
#/c/Program\ Files/WinRAR/WinRAR a -r -afzip sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*
#/c/Program\ Files/Git/mingw64/zip -r sia-cluster-$SIA_CLUSTER_VERSION.zip $SIA_RELEASE_PATH/*

rm sia-cluster-bundle-$SIA_CLUSTER_VERSION.zip
zip -q -9 -r sia-cluster-bundle-$SIA_CLUSTER_VERSION.zip $SIA_CLUSTER_RELEASE_PATH $SIA_NODE_RELEASE_PATH


echo "Done."

popd



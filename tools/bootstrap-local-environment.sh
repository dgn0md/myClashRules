#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
NODE_VERSION=$(cat "$ROOT/.node-version")
NPM_VERSION=$(cat "$ROOT/.npm-version")
SYSTEM=$(uname -s)
ARCH=$(uname -m)

case "$SYSTEM:$ARCH" in
  Darwin:arm64)
    PLATFORM=darwin-arm64
    NODE_ARCHIVE="node-v$NODE_VERSION-darwin-arm64.tar.xz"
    NODE_SHA256=3f1cf157479c1480352083105e13faf9d008ede98e7e157746b6df940d197b94
    ;;
  Linux:x86_64)
    PLATFORM=linux-x64
    NODE_ARCHIVE="node-v$NODE_VERSION-linux-x64.tar.xz"
    NODE_SHA256=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647
    ;;
  *)
    echo "本地工具链暂不支持 $SYSTEM/$ARCH" >&2
    exit 1
    ;;
esac

LOCAL="$ROOT/.local"
TOOLCHAIN="$LOCAL/toolchain"
DOWNLOADS="$TOOLCHAIN/downloads"
NODE_DIR="$TOOLCHAIN/node-v$NODE_VERSION-$PLATFORM"
NODE_BIN="$NODE_DIR/bin/node"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/$NODE_ARCHIVE"
NODE_MIRROR_URL="https://mirrors.huaweicloud.com/nodejs/$NODE_VERSION/$NODE_ARCHIVE"
NODE_TARBALL="$DOWNLOADS/$NODE_ARCHIVE"
BUNDLED_NPM_CLI="$NODE_DIR/lib/node_modules/npm/bin/npm-cli.js"
NPM_PREFIX="$TOOLCHAIN/npm"
NPM_CLI="$NPM_PREFIX/node_modules/npm/bin/npm-cli.js"
LOCAL_HOME="$LOCAL/home"
LOCAL_TMP="$LOCAL/tmp"
for path in "$LOCAL" "$ROOT/node_modules"; do
  if [ -L "$path" ]; then
    echo "拒绝使用工作区外部链接：$path" >&2
    exit 1
  fi
done
mkdir -p "$DOWNLOADS" "$LOCAL/npm-cache" "$LOCAL_HOME" "$LOCAL_TMP" "$NPM_PREFIX/etc"

# Keep npm configuration, its cache, HOME-based tool caches, and temp files
# inside the repository so deleting this directory removes the whole toolchain.
export HOME="$LOCAL_HOME"
export TMPDIR="$LOCAL_TMP"
unset NPM_CONFIG_USERCONFIG NPM_CONFIG_GLOBALCONFIG NPM_CONFIG_CACHE NPM_CONFIG_GLOBAL NPM_CONFIG_PREFIX NPM_CONFIG_REGISTRY
unset npm_config_userconfig npm_config_globalconfig npm_config_cache npm_config_global npm_config_prefix npm_config_registry
export npm_config_userconfig="$ROOT/.npmrc"
export npm_config_globalconfig="$NPM_PREFIX/etc/npmrc"
export npm_config_cache="$LOCAL/npm-cache"
export npm_config_global=false
export npm_config_registry=https://registry.npmjs.org/
export NODE_USE_ENV_PROXY=1
unset NODE_PATH NODE_OPTIONS

hash_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    echo "需要系统自带的 shasum 或 sha256sum 来校验官方 Node 归档" >&2
    exit 1
  fi
}

if [ ! -x "$NODE_BIN" ] || [ "$("$NODE_BIN" --version 2>/dev/null || true)" != "v$NODE_VERSION" ]; then
  if [ ! -f "$NODE_TARBALL" ] || [ "$(hash_file "$NODE_TARBALL")" != "$NODE_SHA256" ]; then
    rm -f "$NODE_TARBALL"
    NODE_TARBALL_PART="$NODE_TARBALL.part"
    rm -f "$NODE_TARBALL_PART"
    echo "从 Node.js 官方地址下载 v$NODE_VERSION ..."
    if curl -fL --retry 3 --connect-timeout 15 "$NODE_URL" -o "$NODE_TARBALL_PART"; then
      mv "$NODE_TARBALL_PART" "$NODE_TARBALL"
    else
      rm -f "$NODE_TARBALL_PART"
      echo "官方地址不可用，改用华为云 Node.js 镜像 ..."
      curl -fL --retry 3 --connect-timeout 15 "$NODE_MIRROR_URL" -o "$NODE_TARBALL_PART"
      mv "$NODE_TARBALL_PART" "$NODE_TARBALL"
    fi
  fi
  ACTUAL_SHA256=$(hash_file "$NODE_TARBALL")
  if [ "$ACTUAL_SHA256" != "$NODE_SHA256" ]; then
    rm -f "$NODE_TARBALL"
    echo "Node 归档 SHA-256 不匹配：$ACTUAL_SHA256" >&2
    exit 1
  fi
  EXTRACT_DIR="$TOOLCHAIN/extract-$$"
  rm -rf "$EXTRACT_DIR"
  mkdir -p "$EXTRACT_DIR"
  tar -xf "$NODE_TARBALL" -C "$EXTRACT_DIR"
  rm -rf "$NODE_DIR"
  mv "$EXTRACT_DIR/node-v$NODE_VERSION-$PLATFORM" "$NODE_DIR"
  rmdir "$EXTRACT_DIR"
fi

if [ "$("$NODE_BIN" --version)" != "v$NODE_VERSION" ]; then
  echo "本地 Node 版本校验失败" >&2
  exit 1
fi

BUNDLED_NPM_VERSION=$("$NODE_BIN" "$BUNDLED_NPM_CLI" --version)
LOCAL_NPM_VERSION=$("$NODE_BIN" "$NPM_CLI" --version 2>/dev/null || true)
if [ "$LOCAL_NPM_VERSION" != "$NPM_VERSION" ]; then
  echo "在项目本地安装 npm@${NPM_VERSION}（引导 npm ${BUNDLED_NPM_VERSION}）..."
  PATH="$NODE_DIR/bin:$PATH" "$NODE_BIN" "$BUNDLED_NPM_CLI" install \
    --prefix "$NPM_PREFIX" "npm@$NPM_VERSION" --save-exact \
    --ignore-scripts --no-audit --no-fund --cache "$LOCAL/npm-cache" \
    --userconfig "$ROOT/.npmrc" --globalconfig "$NPM_PREFIX/etc/npmrc"
fi

if [ "$("$NODE_BIN" "$NPM_CLI" --version)" != "$NPM_VERSION" ]; then
  echo "本地 npm 版本校验失败" >&2
  exit 1
fi

echo "使用项目隔离的 Node v$NODE_VERSION 和 npm v$NPM_VERSION"
"$ROOT/tools/npmw" ci
"$ROOT/tools/npmw" run native:setup
echo "项目本地环境就绪；后续命令使用 ./tools/npmw，不调用系统 Node/npm。"

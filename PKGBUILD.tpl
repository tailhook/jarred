# Maintainer: Paul Colomiets <paul@colomiets.name>

pkgname=jarred
pkgver=${VERSION}
pkgrel=1
pkgdesc="A web frontend to collectd and rrd to json command-line extractor"
arch=('i686' 'x86_64')
url="http://github.com/tailhook/procboss"
license=('MIT')
depends=('zeromq' 'rrdtool')
optdepend=(
    "zerogw: Running web frontend"
    )
backup=("etc/jarred/presets.js" "etc/jarred/rules_local.js")
source=(
    "https://github.com/downloads/tailhook/jarred/$pkgname-$pkgver.tar.gz"
    "jarred.install"
    )
md5sums=('${DIST_MD5}' 'edb081accac11c7bb84981abe0063b83')
install=(jarred.install)

build() {
  cd $srcdir/$pkgname-$pkgver
  ./waf configure --prefix=/usr
  ./waf build
}

package() {
  cd $srcdir/$pkgname-$pkgver
  ./waf install --destdir=$pkgdir
  install -D -m 644 public/js/presets.js.sample $pkgdir/etc/jarred/presets.js
  install -D -m 755 jarred.rc $pkgdir/etc/rc.d/jarred
  install -D -m 644 jarred-zerogw.yaml $pkgdir/etc/zerogw.d/jarred.yaml
  touch $pkgdir/etc/jarred/rules_local.js
  mkdir -p $pkgdir/usr/share/jarred/public
  cp -R public/* $pkgdir/usr/share/jarred/public
  ln -s /etc/jarred/presets.js $pkgdir/usr/share/jarred/public/js/presets.js
  ln -s /etc/jarred/rules_local.js $pkgdir/usr/share/jarred/public/js/rules_local.js
  install -D -m644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}

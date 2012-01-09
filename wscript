#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from waflib import Utils, Options
from waflib.Build import BuildContext
from waflib.Scripting import Dist
import subprocess
import os.path

APPNAME='jarred'
if os.path.exists('.git'):
    VERSION=subprocess.getoutput('git describe').lstrip('v').replace('-', '_')
else:
    VERSION='0.2'

top = '.'
out = 'build'

def options(opt):
    opt.load('compiler_c')

def configure(conf):
    conf.load('compiler_c')

def build(bld):
    bld(
        features     = ['c', 'cprogram'],
        source       = [
            'src/cli.c',
            'src/buffer.c',
            'src/roundrobin.c',
            ],
        target       = 'jarred-cli',
        includes     = ['src'],
        cflags       = ['-std=c99', '-Wall'],
        lib          = ['rrd'],
        )
    bld(
        features     = ['c', 'cprogram'],
        source       = [
            'src/zerogw.c',
            'src/buffer.c',
            'src/roundrobin.c',
            ],
        target       = 'jarred-zgw',
        includes     = ['src'],
        cflags       = ['-std=c99', '-Wall'],
        lib          = ['rrd', 'zmq'],
        )

def dist(ctx):
    ctx.excl = [
        'doc/_build/**',
        '.waf*', '*.tar.gz', '*.zip', 'build', '.boss*',
        '.git*', '.lock*', '**/*.pyc', '**/*.swp', '**/*~',
        'tmp/**', 'public/js/presets.js', 'public/js/rules_local.js',
        ]
    ctx.algo = 'tar.gz'


def make_pkgbuild(task):
    import hashlib
    task.outputs[0].write(Utils.subst_vars(task.inputs[0].read(), {
        'VERSION': VERSION,
        'DIST_MD5': hashlib.md5(task.inputs[1].read('rb')).hexdigest(),
        }))


def archpkg(ctx):
    from waflib import Options
    Options.commands = ['dist', 'makepkg'] + Options.commands


def build_package(bld):
    distfile = APPNAME + '-' + VERSION + '.tar.gz'
    bld(rule=make_pkgbuild,
        source=['PKGBUILD.tpl', distfile, 'wscript'],
        target='PKGBUILD')
    bld(rule='cp ${SRC} ${TGT}', source=distfile, target='.')
    bld(rule='cp ${SRC} ${TGT}', source='jarred.install', target='.')
    bld.add_group()
    bld(rule='makepkg -f', source=distfile)
    bld.add_group()
    bld(rule='makepkg -f --source', source=distfile)


class makepkg(BuildContext):
    cmd = 'makepkg'
    fun = 'build_package'
    variant = 'archpkg'


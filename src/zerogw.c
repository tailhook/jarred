#include <zmq.h>
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <getopt.h>
#include <unistd.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include <dirent.h>

#include "roundrobin.h"
#include "buffer.h"

#define STDASSERT(val) if(val < 0) { perror(#val); abort(); }
#define TRUE 1
#define FALSE 0

void print_usage(FILE *out) {
    fprintf(out, "Usage:\n");
    fprintf(out, "    jarred-zgw -c ipc:///connect/to/path [ -d rrd/dir ]\n");
    fprintf(out, "\n");
    fprintf(out, "Options:\n");
    fprintf(out, "  -c      Zeromq address to connect to\n");
    fprintf(out, "  -b      Zeromq address to bind to\n");
    fprintf(out, "  -d      Directory to serve rrd files from\n");
    fprintf(out, "  -p      Url path prefix to strip from target path\n");
}

void free_buffer(void *data, buffer_t *buf) {
    buffer_free(buf);
    free(buf);
}

void parse_and_execute(char *dir, char *presetdir,
                       char *url, int ulen, buffer_t *buf)
{
    char *urlend = url + ulen;
    if(urlend == url)
        return; // Empty path, can't do anything
    if(ulen >= 11 && !strncmp(urlend - 11, "/index.json", 11)) {
        if(ulen == 11) {
            // It's root index, let's send short index
            STDASSERT(buffer_printf(buf, "{\"presets\": [\n"));
            DIR *dhandle = opendir(presetdir);
            if(dhandle) {
                struct dirent *ent;
                int first = TRUE;
                while((ent = readdir(dhandle))) {
                    if(ent->d_name[0] == '.') continue;
                    if(!first) {
                        STDASSERT(buffer_printf(buf, ",\n"));
                    } else {
                        first = FALSE;
                    }
                    STDASSERT(buffer_printf(buf, "\"%s\"", ent->d_name));
                }
                STDASSERT(closedir(dhandle));
            }
            STDASSERT(buffer_printf(buf, "\n], \"hosts\": [\n"));
            dhandle = opendir(dir);
            if(dhandle) {
                struct dirent *ent;
                int first = TRUE;
                while((ent = readdir(dhandle))) {
                    if(ent->d_name[0] == '.') continue;
                    if(!first) {
                        STDASSERT(buffer_printf(buf, ",\n"));
                    } else {
                        first = FALSE;
                    }
                    STDASSERT(buffer_printf(buf, "\"%s\"", ent->d_name));
                }
                STDASSERT(closedir(dhandle));
            }
            STDASSERT(buffer_printf(buf, "]}\n"));
        } else {
            // It's a directory, let's send info on all files
            int dirlen = strlen(dir);
            char fulldir[dirlen + urlend - url - 10];
            strcpy(fulldir, dir);
            if(fulldir[dirlen-1] == '/') {
                fulldir[dirlen-1] = 0;
            }
            assert(url[0] == '/');
            strncat(fulldir, url, urlend - url - 10);
            char *dirs[] = {fulldir, NULL};
            quickvisit_tree(buf, dirs, strlen(fulldir));
        }
    } else {
        char *query = memchr(url, '?', urlend - url);
        if(!query) {
            buffer_printf(buf, "{\"error\": \"no query\"}");
            return;
        }
        int dirlen = strlen(dir);
        char fullpath[dirlen + query - url + 1];
        strcpy(fullpath, dir);
        int fullen = dirlen;
        if(fullpath[dirlen-1] == '/') {
            fullpath[dirlen-1] = 0;
            fullen --;
        }
        assert(url[0] == '/');
        if(*(query-1) == '/') {
            char *dirs[] = {fullpath, NULL};
            traverse_tree(buf, dirs, strlen(fullpath));
            return;
        }
        strncpy(fullpath + fullen, url, query - url);
        fullen += query - url;
        if(fullen > 5 && !memcmp(fullpath+fullen-5, ".json", 5)) {
            fullen -= 5;
            fullpath[fullen] = 0;
        } else {
            fullpath[fullen] = 0;
        }
        char cf[16] = "AVERAGE";
        char sbuf[16];
        time_t start = 0;
        time_t end = 0;
        int step = 0;
        for(char *q = query+1; q < urlend;) {
            char *eq = memchr(q, '=', urlend - q);
            char *amp = memchr(q, '&', urlend - q);
            if(amp && amp < eq) {
                q = amp+1;
                continue;
            }
            if(!eq) break;
            if(!amp) amp = urlend;
            if(eq - q == 2 && !strncmp(q, "cf", 2)) {
                int len = amp - eq - 1;
                if(len > 15) len = 15;
                memcpy(cf, eq+1, len);
                cf[len] = 0;
            } if(eq - q == 5 && !strncmp(q, "start", 5)) {
                int len = amp - eq - 1;
                if(len > 15) len = 15;
                memcpy(sbuf, eq+1, len);
                sbuf[len] = 0;
                start = strtol(sbuf, NULL, 10);
            } if(eq - q == 3 && !strncmp(q, "end", 3)) {
                int len = amp - eq - 1;
                if(len > 15) len = 15;
                memcpy(sbuf, eq+1, len);
                sbuf[len] = 0;
                end = strtol(sbuf, NULL, 10);
            } if(eq - q == 4 && !strncmp(q, "step", 4)) {
                int len = amp - eq - 1;
                if(len > 15) len = 15;
                memcpy(sbuf, eq+1, len);
                sbuf[len] = 0;
                step = strtol(sbuf, NULL, 10);
            }
            q = amp+1;
        }
        format_data(buf, fullpath, cf, start, end, step);
    }
}

int main(int argc, char **argv) {
    void *zmqcontext = zmq_init(1);
    assert(zmqcontext);
    void *zmqsock = zmq_socket(zmqcontext, ZMQ_REP);
    assert(zmqsock);
    char *dir = NULL;
    char *prefix = "";
    char *presetdir = "/etc/jarred";
    int prefixlen = 0;

    int opt;
    while((opt = getopt(argc, argv, "hc:b:d:p:s:")) != -1) {
        switch(opt) {
        case 'c': // connect
            STDASSERT(zmq_connect(zmqsock, optarg))
            break;
        case 'b': // bind
            STDASSERT(zmq_bind(zmqsock, optarg))
            break;
        case 'd': // dir
            dir = optarg;
            break;
        case 'p': // prefix
            prefix = optarg;
            prefixlen = strlen(optarg);
            break;
        case 's': // dir with presets
            presetdir = optarg;
            break;
        case 'h':
            print_usage(stdout);
            exit(0);
        default:
            print_usage(stderr);
            exit(1);
        }
    }
    if(!dir) {
        dir = getcwd(NULL, 0);
    }

    while(TRUE) {
        zmq_msg_t msg;
        zmq_msg_init(&msg);
        int rc = zmq_recv(zmqsock, &msg, 0);
        if(rc < 0) {
            if(errno == EINTR || errno == EAGAIN) continue;
            perror("Error receiving message");
            abort();
        }
        uint64_t opt;
        size_t opt_size = sizeof(opt);
        STDASSERT(zmq_getsockopt(zmqsock, ZMQ_RCVMORE, &opt, &opt_size));
        assert(!opt); // could reopen socket, but restart is ok
        buffer_t *buf = malloc(sizeof(buffer_t));
        buffer_init(buf, 1024);
        char *data = zmq_msg_data(&msg);
        int dlen = zmq_msg_size(&msg);
        if(dlen < prefixlen) {
            buffer_printf(buf, "{\"error\": \"uri too short\"}");
        } else if(memcmp(data, prefix, prefixlen)) {
            buffer_printf(buf, "{\"error\": \"wrong path prefix\"}");
        } else {
            data += prefixlen;
            dlen -= prefixlen;
            parse_and_execute(dir, presetdir, data, dlen, buf);
        }
        zmq_msg_init_data(&msg, buf->data, buf->size,
            (void (*)(void*, void*))free_buffer, buf);
        STDASSERT(zmq_send(zmqsock, &msg, 0));
    }
    zmq_close(zmqsock);
    zmq_term(zmqcontext);
    // Free directory if needed
}

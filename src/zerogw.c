#include <zmq.h>
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <getopt.h>
#include <unistd.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

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
}

void free_buffer(void *data, buffer_t *buf) {
    buffer_free(buf);
    free(buf);
}

void parse_and_execute(char *dir, zmq_msg_t *msg, buffer_t *buf) {
    char *url = zmq_msg_data(msg);
    char *urlend = url + zmq_msg_size(msg);
    if(urlend == url)
        return; // Empty path, can't do anything
    if(urlend[-1] == '/') {
        // It's a directory, let's send info on all files
        int dirlen = strlen(dir);
        char fulldir[dirlen + urlend - url + 1];
        strcpy(fulldir, dir);
        if(fulldir[dirlen-1] == '/') {
            fulldir[dirlen-1] = 0;
        }
        assert(url[0] == '/');
        strncat(fulldir, url, urlend - url - 1);
        char *dirs[] = {fulldir, NULL};
        traverse_tree(buf, dirs, strlen(fulldir));
    } else {
        char *query = memchr(url, '?', urlend - url);
        if(!query) {
            buffer_printf(buf, "{\"error\": \"no query\"}");
            return;
        }
        int dirlen = strlen(dir);
        char fullpath[dirlen + query - url + 1];
        strcpy(fullpath, dir);
        if(fullpath[dirlen-1] == '/') {
            fullpath[dirlen-1] = 0;
        }
        assert(url[0] == '/');
        strncat(fullpath, url, query - url);
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

    int opt;
    while((opt = getopt(argc, argv, "hc:b:d:")) != -1) {
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
        parse_and_execute(dir, &msg, buf);
        zmq_msg_init_data(&msg, buf->data, buf->size,
            (void (*)(void*, void*))free_buffer, buf);
        STDASSERT(zmq_send(zmqsock, &msg, 0));
    }
    zmq_close(zmqsock);
    zmq_term(zmqcontext);
    // Free directory if needed
}

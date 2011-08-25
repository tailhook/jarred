#include "roundrobin.h"
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/time.h>
#include <string.h>
#include <errno.h>

#define STDASSERT(val) if(val < 0) { perror(#val); abort(); }

int main(int argc, char **argv) {
    buffer_t buf;
    STDASSERT(buffer_init(&buf, 4096));

    if(argc >= 2) {
        if(!strcmp(argv[1], "index")) {
            traverse_tree(&buf, argv+2);
        } else if(!strcmp(argv[1], "fetch")) {
            if(argc < 7) {
                fprintf(stderr, "At least 6 arguments expected:"
                    "filename consolidation_func start end step ds_names");
            } else {
                time_t start, end;
                unsigned long step;
                start = strtol(argv[4], NULL, 10);
                end = strtol(argv[5], NULL, 10);
                step = strtol(argv[6], NULL, 10);
                format_data(&buf, argv[2], argv[3], start, end, step);
            }
        } else {
            fprintf(stderr, "Wrong command ``%s''\n", argv[1]);
        }
    }

    char *start = buf.data;
    char *end = buf.data + buf.size;
    while(start < end) {
        int res = write(1, start, end - start);
        if(res < 0) {
            if(errno == EAGAIN) continue;
            perror("write");
            abort();
        }
        start += res;
    }
    buffer_free(&buf);
    return 0;
}

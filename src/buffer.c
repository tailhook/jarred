#include <malloc.h>
#include <stdarg.h>

#include "buffer.h"

int buffer_init(buffer_t *buffer, size_t nbytes) {
    buffer->data = malloc(nbytes);
    if(!buffer->data) return -1;
    buffer->size = 0;
    buffer->capacity = nbytes;
    return 0;
}

void buffer_free(buffer_t *buffer) {
    free(buffer->data);
}

int buffer_printf(buffer_t *buf, char *format, ...) {
    va_list args;
    while(1) {
        va_start(args, format);
        int len = vsnprintf(buf->data+buf->size, buf->capacity - buf->size,
            format, args);
        va_end(args);
        if(len >= buf->capacity - buf->size) {
            size_t ncap = buf->capacity*2;
            if(ncap - buf->size <= len) {
                ncap = buf->size + len + 1;
            }
            char *nbuf = realloc(buf->data, ncap);
            if(!nbuf) {
                return -1;
            }
            buf->data = nbuf;
            buf->capacity = ncap;
            continue;
        }
        buf->size += len;
        break;
    }
    va_end(args);
    return 0;
}

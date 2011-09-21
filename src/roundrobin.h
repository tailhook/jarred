#ifndef _H_ROUNDROBIN
#define _H_ROUNDROBIN

#include <sys/time.h>

#include "buffer.h"

void traverse_tree(buffer_t *buf, char **dirs, int strip_chars);
void quickvisit_tree(buffer_t *buf, char **dirs, int strip_chars);
void format_data(buffer_t *buf, char *filename, char *cf,
    time_t start, time_t end, unsigned long step);

#endif //_H_ROUNDROBIN
